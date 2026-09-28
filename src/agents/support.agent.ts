/**
 * WHY: Primary CX agent — DNA declares tools/policies; real handlers live here.
 */

import { Service } from '@hazeljs/core';
import { Agent, Tool } from '@hazeljs/agent';
import { Read, Reversible, Compensate } from '@hazeljs/agent-vm';
import type { EffectRecord } from '@hazeljs/agent-vm';
import { commerceStore } from '../data/commerce.store';

@Agent({
  name: 'support-desk',
  description:
    'Meridian Commerce customer support. Looks up orders, tracks shipments, refunds with human approval.',
  systemPrompt: `You are the Meridian Commerce support desk agent.
Be concise and factual. Always use tools for order facts — never invent tracking numbers or refund IDs.
When a customer wants a refund, look up the order first, then call processRefund.
End with a clear next step.`,
  maxSteps: 8,
  temperature: 0.2,
})
@Service()
export class SupportDeskAgent {
  @Tool({
    name: 'lookupOrder',
    description: 'Look up an order by ID (e.g. ORD-1001).',
    parameters: [
      { name: 'orderId', type: 'string', description: 'Order ID like ORD-1001', required: true },
    ],
    readOnly: true,
  })
  @Read()
  async lookupOrder({ orderId }: { orderId: string }) {
    const order = commerceStore.getOrder(orderId);
    if (!order) return { found: false, error: `No order ${orderId}` };
    return { found: true, order };
  }

  @Tool({
    name: 'trackShipment',
    description: 'Get shipment tracking details for an order.',
    parameters: [
      { name: 'orderId', type: 'string', description: 'Order ID', required: true },
    ],
    readOnly: true,
  })
  @Read()
  async trackShipment({ orderId }: { orderId: string }) {
    return commerceStore.getShipment(orderId);
  }

  @Tool({
    name: 'processRefund',
    description: 'Process a refund for an order. Requires human approval.',
    requiresApproval: true,
    parameters: [
      { name: 'orderId', type: 'string', description: 'Order ID', required: true },
      { name: 'amount', type: 'number', description: 'Refund amount in USD', required: true },
      { name: 'reason', type: 'string', description: 'Reason for refund', required: false },
    ],
  })
  @Reversible({ compensate: 'processRefund' })
  async processRefund({
    orderId,
    amount,
    reason,
  }: {
    orderId: string;
    amount: number;
    reason?: string;
  }) {
    const result = commerceStore.createRefund(orderId, amount, reason ?? 'customer request');
    if ('error' in result) return { success: false, error: result.error };
    return { success: true, refund: result };
  }

  @Compensate('processRefund')
  async undoProcessRefund(
    effect: EffectRecord<{ success: boolean; refund?: { id: string } }>
  ) {
    const refundId = effect.output?.refund?.id;
    if (!refundId) return { reversed: false, reason: 'no refund id in journal output' };
    return commerceStore.reverseRefund(refundId);
  }
}
