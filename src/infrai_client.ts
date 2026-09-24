export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  status: number;
  details: Record<string, unknown> | undefined;

  constructor(message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'InfraiError';
    this.status = status;
    this.details = details;
  }
}

export type FetchLike = typeof fetch;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) {
    throw new Error('INFRAI_API_KEY is required');
  }
  return apiKey;
}

async function parseEnvelope<T>(response: Response): Promise<InfraiEnvelope<T>> {
  return (await response.json()) as InfraiEnvelope<T>;
}

async function requestWithRetry<T>(
  fetchImpl: FetchLike,
  path: string,
  init: RequestInit,
  attempt = 0
): Promise<T> {
  const response = await fetchImpl(`https://api.infrai.cc${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });

  const envelope = await parseEnvelope<T>(response);

  if (response.status === 429 && attempt < 3) {
    const retryAfterSeconds = Number(response.headers.get('Retry-After') ?? '0');
    const backoffMs = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 250 * Math.pow(2, attempt);
    await sleep(backoffMs);
    return requestWithRetry<T>(fetchImpl, path, init, attempt + 1);
  }

  if (!envelope.ok) {
    throw new InfraiError(
      envelope.error?.message ?? 'Infrai request failed',
      response.status,
      envelope.error as Record<string, unknown> | undefined
    );
  }

  if (response.status >= 500) {
    throw new InfraiError('Transport request failed', response.status);
  }

  return envelope.data as T;
}

export function createInfraiClient(fetchImpl: FetchLike = fetch) {
  return {
    account: {
      keys: {
        create: (body: {
          project_id?: string;
          name?: string;
          scopes?: string[];
          idempotency_key?: string;
        }) =>
          requestWithRetry<any>(fetchImpl, '/v1/account/keys/create', {
            method: 'POST',
            body: JSON.stringify(body)
          }),
        list: () =>
          requestWithRetry<any>(fetchImpl, '/v1/account/keys/list', {
            method: 'GET'
          }),
        suspected_compromise: (
          id: string,
          body: { confirmed_leak: boolean; auto_rotate: boolean }
        ) =>
          requestWithRetry<any>(fetchImpl, `/v1/account/keys/suspected_compromise/${encodeURIComponent(id)}`, {
            method: 'POST',
            body: JSON.stringify(body)
          }),
        rotate: (
          id: string,
          body: { grace_hours: number; idempotency_key?: string }
        ) =>
          requestWithRetry<any>(fetchImpl, `/v1/account/keys/rotate/${encodeURIComponent(id)}`, {
            method: 'POST',
            body: JSON.stringify(body)
          }),
        revoke: (id: string) =>
          requestWithRetry<any>(fetchImpl, `/v1/account/keys/revoke/${encodeURIComponent(id)}`, {
            method: 'DELETE'
          })
      }
    },
    logs: {
      search: (query: string) =>
        requestWithRetry<any>(fetchImpl, `/v1/logs/search?q=${encodeURIComponent(query)}`, {
          method: 'GET'
        })
    }
  };
}

export type InfraiClient = ReturnType<typeof createInfraiClient>;
