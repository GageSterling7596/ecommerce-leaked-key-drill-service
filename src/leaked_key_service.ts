import { leakedKeyDrillRequestSchema, type LeakedKeyDrillRequest, type OrderInput } from './incident_schema';
import type { InfraiClient } from './infrai_client';

export type OrderUpdate = {
  orderId: string;
  action: 'hold_fulfillment' | 'continue_fulfillment';
  customerEmail: string;
  message: string;
};

export type ReceiptAction = {
  orderId: string;
  receiptStatus: 'flagged_for_manual_review' | 'unchanged';
};

export type DrillResult = {
  incidentStatus: 'reported' | 'rotated' | 'confirmed';
  affectedOrders: OrderUpdate[];
  receipts: ReceiptAction[];
  customerUpdates: OrderUpdate[];
  blastRadiusSummary: {
    searchedQuery: string;
    suspectedOrderIds: string[];
  };
  replacementKey: {
    keyId: string;
    plaintextKey: string | null;
  };
};

function buildOrderUpdate(order: OrderInput, suspectedOrderIds: Set<string>): OrderUpdate {
  const affected = suspectedOrderIds.has(order.orderId);

  return {
    orderId: order.orderId,
    action: affected ? 'hold_fulfillment' : 'continue_fulfillment',
    customerEmail: order.customerEmail,
    message: affected
      ? `Order ${order.orderId} is on hold while we verify checkout activity.`
      : `Order ${order.orderId} is still moving through fulfillment.`
  };
}

export function decideOrderActions(orders: OrderInput[], suspectedOrderIds: string[]) {
  const suspectedSet = new Set(suspectedOrderIds);

  const affectedOrders = orders.map((order) => buildOrderUpdate(order, suspectedSet));
  const receipts: ReceiptAction[] = orders.map((order) => ({
    orderId: order.orderId,
    receiptStatus: suspectedSet.has(order.orderId) ? 'flagged_for_manual_review' : 'unchanged'
  }));

  return {
    affectedOrders,
    receipts,
    customerUpdates: affectedOrders
  };
}

function makeIdempotencyKey(prefix: string, leakedKeyId: string) {
  return `${prefix}-${leakedKeyId}`;
}

export async function runLeakedKeyDrill(input: LeakedKeyDrillRequest, infrai: InfraiClient): Promise<DrillResult> {
  const request = leakedKeyDrillRequestSchema.parse(input);

  await infrai.account.keys.list();

  const replacementKeyResponse = await infrai.account.keys.create({
    name: request.replacementKeyName,
    scopes: request.replacementScopes,
    idempotency_key: makeIdempotencyKey('create', request.leakedKeyId)
  });

  await infrai.account.keys.suspected_compromise(request.leakedKeyId, {
    confirmed_leak: request.reportConfirmedLeak,
    auto_rotate: request.autoRotateOnReport
  });

  await infrai.logs.search(request.logQuery);

  await infrai.account.keys.rotate(String(replacementKeyResponse.key_id), {
    grace_hours: request.rotationGraceHours,
    idempotency_key: makeIdempotencyKey('rotate', request.leakedKeyId)
  });

  const decisions = decideOrderActions(request.orders, request.suspectedOrderIds);

  await infrai.account.keys.revoke(String(replacementKeyResponse.key_id));

  return {
    incidentStatus: 'confirmed',
    affectedOrders: decisions.affectedOrders,
    receipts: decisions.receipts,
    customerUpdates: decisions.customerUpdates,
    blastRadiusSummary: {
      searchedQuery: request.logQuery,
      suspectedOrderIds: request.suspectedOrderIds
    },
    replacementKey: {
      keyId: String(replacementKeyResponse.key_id),
      plaintextKey: typeof replacementKeyResponse.key_secret === 'string' ? replacementKeyResponse.key_secret : null
    }
  };
}
