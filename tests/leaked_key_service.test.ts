import { describe, expect, it } from 'vitest';
import { decideOrderActions } from '../src/leaked_key_service';

describe('decideOrderActions', () => {
  it('holds fulfillment only for affected orders', () => {
    const result = decideOrderActions(
      [
        {
          orderId: 'ord_1001',
          customerEmail: 'alice@example.com',
          amountUsd: 149.99,
          fulfillmentStatus: 'queued'
        },
        {
          orderId: 'ord_1002',
          customerEmail: 'bob@example.com',
          amountUsd: 42.5,
          fulfillmentStatus: 'packed'
        }
      ],
      ['ord_1001']
    );

    expect(result.affectedOrders).toEqual([
      {
        orderId: 'ord_1001',
        action: 'hold_fulfillment',
        customerEmail: 'alice@example.com',
        message: 'Order ord_1001 is on hold while we verify checkout activity.'
      },
      {
        orderId: 'ord_1002',
        action: 'continue_fulfillment',
        customerEmail: 'bob@example.com',
        message: 'Order ord_1002 is still moving through fulfillment.'
      }
    ]);

    expect(result.receipts).toEqual([
      {
        orderId: 'ord_1001',
        receiptStatus: 'flagged_for_manual_review'
      },
      {
        orderId: 'ord_1002',
        receiptStatus: 'unchanged'
      }
    ]);
  });
});
