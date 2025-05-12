import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  makeIdempotent,
  IdempotencyConfig,
} from '@aws-lambda-powertools/idempotency';
import { CachePersistenceLayer } from '@aws-lambda-powertools/idempotency/cache';
import type { Context } from 'aws-lambda';

const endpoint = process.env.CACHE_ENDPOINT || '';
const port = process.env.CACHE_PORT || '6379';

import { GlideClient } from '@valkey/valkey-glide';

const client = await GlideClient.createClient({
  addresses: [
    {
      host: endpoint,
      port: Number(port),
    },
  ],
  useTLS: true,
});

// Uncomment below and comment above if using @redis/client

/* 
import { createClient } from '@redis/client';

const client = await createClient({
  url: `rediss://${endpoint}:${port}`,
  username: 'default',
}).connect();
*/

const persistenceStore = new CachePersistenceLayer({
  client: client,
});

const createSubscriptionPayment = async (event: { productId: string }) => {
  // ... create payment
  return {
    productId: event.productId,
  };
};

export const handler = makeIdempotent(
  async (event: APIGatewayProxyEventV2, _context: Context) => {
    try {
      const data = JSON.parse(event.body || '{}');
      const payment = await createSubscriptionPayment(data);

      return {
        paymentId: payment.productId,
        message: 'success',
        statusCode: 200,
      };
    } catch (error) {
      throw new Error('Error creating payment');
    }
  },
  {
    persistenceStore,
    config: new IdempotencyConfig({
      eventKeyJmesPath: 'powertools_json(body)',
    }),
  }
);
