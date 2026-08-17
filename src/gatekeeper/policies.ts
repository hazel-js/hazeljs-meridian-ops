/**
 * Meridian Gatekeeper policies — default deny, explicit allows, HITL writes.
 *
 * DNA PolicyRule shapes (`effect: require_approval`) are converted via
 * policiesFromDna so overlay stays compatible.
 */

import { policiesFromDna, type AgentGatekeeperPolicy } from '@hazeljs/agent-gatekeeper';

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

  return [allowReads, denyEmptyRefund, refundApproval, freezeApproval, skillgateWrites];
}

/** Merge DNA overlay policies into the live Gatekeeper list (same id replaces). */
export function mergeDnaPolicies(
  policies: AgentGatekeeperPolicy[],
  dna: { policies?: unknown[] }
): void {
  const incoming = policiesFromDna(dna);
  for (const next of incoming) {
    const idx = policies.findIndex((p) => p.id === next.id);
    if (idx >= 0) policies[idx] = next;
    else policies.push(next);
  }
}
