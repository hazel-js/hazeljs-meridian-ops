/**
 * Meridian Gatekeeper policies — default deny, explicit allows, HITL writes.
 */

import type { AgentGatekeeperPolicy } from '@hazeljs/agent-gatekeeper';

export { mergeDnaPolicies } from '@hazeljs/agent-gatekeeper';

/** Read / delegate tools that may run without human approval. */
export const MERIDIAN_ALLOW_TOOLS = [
  'lookupOrder',
  'trackShipment',
  'getRiskSignals',
  'listKbTopics',
  'listOrders',
  'getOrder',
  'getShipment',
  'listRefunds',
  'listTickets',
  'support-desk',
  'fraud-triage',
  'api-concierge',
  'helpdesk',
] as const;

/** Writes that always pause for HITL. */
export const MERIDIAN_APPROVAL_TOOLS = [
  'processRefund',
  'freezeAccount',
  'createTicket',
  'createRefund',
] as const;

function missingField(input: unknown, field: string): boolean {
  if (!input || typeof input !== 'object') return true;
  const value = (input as Record<string, unknown>)[field];
  return value === undefined || value === null || String(value).trim() === '';
}

/** Base policies compiled into every Meridian Gatekeeper instance. */
export function createMeridianPolicies(): AgentGatekeeperPolicy[] {
  const allowReads: AgentGatekeeperPolicy = {
    id: 'allow-catalog-reads',
    version: '1.0.0',
    priority: 10,
    match: { tools: [...MERIDIAN_ALLOW_TOOLS] },
    rules: {
      allowWhen: () => true,
    },
  };

  const denyEmptyRefund: AgentGatekeeperPolicy = {
    id: 'deny-refund-without-order',
    version: '1.0.0',
    priority: 100,
    match: { tools: ['processRefund'] },
    rules: {
      denyWhen: ({ input }) => missingField(input, 'orderId'),
    },
  };

  const refundApproval: AgentGatekeeperPolicy = {
    id: 'refund-needs-approval',
    version: '1.0.0',
    priority: 50,
    match: { tools: ['processRefund'] },
    rules: {
      requireApprovalWhen: () => true,
    },
  };

  const freezeApproval: AgentGatekeeperPolicy = {
    id: 'freeze-needs-approval',
    version: '1.0.0',
    priority: 50,
    match: { tools: ['freezeAccount'] },
    rules: {
      requireApprovalWhen: () => true,
    },
  };

  const skillgateWrites: AgentGatekeeperPolicy = {
    id: 'skillgate-writes-need-approval',
    version: '1.0.0',
    priority: 50,
    match: { tools: ['createTicket', 'createRefund'] },
    rules: {
      requireApprovalWhen: () => true,
    },
  };

  /** Decision Runtime capability — allowed only after Decision policy + HITL path. */
  const allowDecisionRefund: AgentGatekeeperPolicy = {
    id: 'allow-decision-payments-refund',
    version: '1.0.0',
    priority: 40,
    match: { tools: ['payments.refund'] },
    rules: {
      allowWhen: () => true,
    },
  };

  return [
    allowReads,
    denyEmptyRefund,
    refundApproval,
    freezeApproval,
    skillgateWrites,
    allowDecisionRefund,
  ];
}
