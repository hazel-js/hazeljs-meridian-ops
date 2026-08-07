/**
 * Thin Agent OS shell — tools come from Skillgate (dynamic HTTP skills),
 * not from @Tool methods. Domain think stays in the system prompt.
 */

import { Service } from '@hazeljs/core';
import { Agent } from '@hazeljs/agent';

@Agent({
  name: 'api-concierge',
  description:
    'Meridian Commerce ops concierge. Uses Skillgate-governed REST skills for orders, shipments, tickets, and refunds.',
  systemPrompt: `You are the Meridian Commerce ops concierge.
Use tools for every factual claim about orders, shipments, tickets, or refunds — never invent IDs.
Prefer read skills first (getOrder, getShipment, listOrders). For refunds or tickets, call the write skill after looking up the order.
Be concise. End with a clear next step for the operator or customer.
Sample order ids: ORD-1001, ORD-1002, ORD-1003.`,
  maxSteps: 8,
  temperature: 0.2,
})
@Service()
export class ApiConciergeAgent {
  // No @Tool methods — Skillgate registers dynamic HTTP skills onto this agent name.
}
