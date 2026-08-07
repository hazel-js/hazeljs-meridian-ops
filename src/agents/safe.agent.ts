/**
 * WHY: Contract fallback / twin — read-only, no writes.
 */

import { Service } from '@hazeljs/core';
import { Agent, Tool } from '@hazeljs/agent';
import { commerceStore } from '../data/commerce.store';

@Agent({
  name: 'safe-desk',
  description: 'Conservative fallback support agent — lookup only, no refunds.',
  systemPrompt: `You are a safe fallback support agent. Only look up order status.
Never promise refunds. If the customer needs a refund, tell them a specialist will follow up within 1 business day.`,
  maxSteps: 4,
  temperature: 0.1,
})
@Service()
export class SafeDeskAgent {
  @Tool({
    name: 'lookupOrder',
    description: 'Look up an order by ID.',
    parameters: [
      { name: 'orderId', type: 'string', description: 'Order ID', required: true },
    ],
  })
  async lookupOrder({ orderId }: { orderId: string }) {
    const order = commerceStore.getOrder(orderId);
    if (!order) return { found: false, error: `No order ${orderId}` };
    return {
      found: true,
      orderId: order.id,
      status: order.status,
      items: order.items,
    };
  }
}
