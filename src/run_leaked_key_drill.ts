import { createInfraiClient } from './infrai_client';
import { runLeakedKeyDrill } from './leaked_key_service';

const infrai = createInfraiClient();

const request = {
  leakedKeyId: process.env.LEAKED_KEY_ID ?? 'replace-with-leaked-key-id',
  replacementKeyName: 'checkout-drill-replacement',
  replacementScopes: ['logs.search'],
  reportConfirmedLeak: true,
  autoRotateOnReport: false,
  rotationGraceHours: 2,
  logQuery: 'checkout service leaked key drill',
  suspectedOrderIds: ['ord_1001'],
  orders: [
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
  ]
};

const result = await runLeakedKeyDrill(request, infrai);
console.log(JSON.stringify(result, null, 2));
