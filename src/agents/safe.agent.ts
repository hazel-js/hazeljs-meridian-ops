/**
 * WHY: Contract fallback / twin — read-only, no writes.
 * Prompt/description load from dna/safe-desk.dna.json via `@Agent({ dna: true })`
 * (decorator DNA path). Other Meridian agents still use store/platform overlay.
 */

import { Service } from '@hazeljs/core';
import { Agent, Tool } from '@hazeljs/agent';
import { commerceStore } from '../data/commerce.store';

@Agent({
  name: 'safe-desk',
  /** Loads `{projectRoot}/dna/safe-desk.dna.json` on registerAgentInstance. */
  dna: true,
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
