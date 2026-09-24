import { z } from 'zod';

export const orderSchema = z.object({
  orderId: z.string().min(1),
  customerEmail: z.string().email(),
  amountUsd: z.number().nonnegative(),
  fulfillmentStatus: z.enum(['queued', 'packed', 'shipped'])
});

export const leakedKeyDrillRequestSchema = z.object({
  leakedKeyId: z.string().min(1),
  replacementKeyName: z.string().min(1),
  replacementScopes: z.array(z.string().min(1)).min(1),
  reportConfirmedLeak: z.boolean(),
  autoRotateOnReport: z.boolean(),
  rotationGraceHours: z.number().int().min(0).max(24),
  logQuery: z.string().min(1),
  suspectedOrderIds: z.array(z.string().min(1)).min(1),
  orders: z.array(orderSchema).min(1)
});

export type OrderInput = z.infer<typeof orderSchema>;
export type LeakedKeyDrillRequest = z.infer<typeof leakedKeyDrillRequestSchema>;
