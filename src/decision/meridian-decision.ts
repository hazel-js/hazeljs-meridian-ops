/**
 * Meridian Decision Runtime — closed-set refund judgments before Gatekeeper execute.
 * Confidence informs policy; Gatekeeper still authorizes `payments.refund`.
 */

import {
  createDecisionRuntime,
  type DecisionRuntime,
  type DecisionResult,
} from '@hazeljs/decision';
import type { AgentGatekeeper } from '@hazeljs/agent-gatekeeper';
import type { CheckpointService, HumanTaskService } from '@hazeljs/agent';
import { commerceStore } from '../data/commerce.store';

/** DNA-aligned refund decision (also declared on support-desk DNA). */
export const MERIDIAN_REFUND_DECISION = {
  name: 'refund-approval',
  version: '1',
  objective: 'Determine whether the requested refund should proceed',
  choices: ['approve', 'reject', 'review'] as const,
  risk: 'high' as const,
  strategy: { mode: 'human-required' as const },
  provider: 'hazel-agent',
  confidence: { high: 0.95, medium: 0.7 },
  evidence: {
    required: ['amount', 'priorRefunds'],
    projections: [
      { key: 'amount', from: 'amount', relevance: 1 },
      { key: 'priorRefunds', from: 'refundHistory.count', relevance: 0.8 },
      {
        key: 'large-refund',
        from: 'amount',
        transform: { type: 'boolean' as const, gte: 500 },
        relevance: 0.95,
      },
    ],
  },
  scoring: {
    approve: [
      { evidenceKey: 'large-refund', weight: -0.8, when: 'truthy' as const },
      { evidenceKey: 'priorRefunds', weight: -0.2, when: 'gt0' as const },
    ],
    reject: [{ evidenceKey: 'priorRefunds', weight: 0.3, when: 'gt0' as const }],
    review: [
      { evidenceKey: 'large-refund', weight: 0.9, when: 'truthy' as const },
      { evidenceKey: 'amount', weight: 0.4, when: 'gt0' as const },
    ],
  },
  onTie: 'review',
  execution: {
    approve: { capability: 'payments.refund' },
    review: { hitl: true },
  },
};

export type MeridianRefundState = {
  orderId: string;
  amount: number;
  reason?: string;
  refundHistory: { count: number };
};

let shared: DecisionRuntime | undefined;

export function createMeridianDecisionRuntime(opts: {
  gatekeeper?: AgentGatekeeper;
  checkpoints?: CheckpointService;
  humanTasks?: HumanTaskService;
}): DecisionRuntime {
  const runtime = createDecisionRuntime({
    gatekeeper: opts.gatekeeper,
    checkpoints: opts.checkpoints,
    humanTasks: opts.humanTasks,
    defaultAgentId: 'support-desk',
    capabilityHandlers: {
      'payments.refund': async ({ state }) => {
        const s = state as MeridianRefundState | undefined;
        if (!s?.orderId || typeof s.amount !== 'number') {
          return { success: false, error: 'Missing orderId/amount on decision state' };
        }
        const result = commerceStore.createRefund(
          s.orderId,
          s.amount,
          s.reason ?? 'decision-runtime approved'
        );
        if ('error' in result) return { success: false, error: result.error };
        return { success: true, refund: result };
      },
    },
  });

  runtime.registry.register({
    name: MERIDIAN_REFUND_DECISION.name,
    version: MERIDIAN_REFUND_DECISION.version,
    objective: MERIDIAN_REFUND_DECISION.objective,
    choices: [...MERIDIAN_REFUND_DECISION.choices],
    risk: MERIDIAN_REFUND_DECISION.risk,
    strategy: MERIDIAN_REFUND_DECISION.strategy,
    provider: MERIDIAN_REFUND_DECISION.provider,
    confidence: MERIDIAN_REFUND_DECISION.confidence,
    evidence: MERIDIAN_REFUND_DECISION.evidence,
    scoring: MERIDIAN_REFUND_DECISION.scoring,
    onTie: MERIDIAN_REFUND_DECISION.onTie,
    execution: MERIDIAN_REFUND_DECISION.execution,
  });

  shared = runtime;
  return runtime;
}

export function getMeridianDecisionRuntime(): DecisionRuntime | undefined {
  return shared;
}

export async function decideRefund(input: {
  orderId: string;
  amount: number;
  reason?: string;
  runId?: string;
}): Promise<DecisionResult> {
  const runtime = shared;
  if (!runtime) {
    throw new Error('Decision Runtime not initialized — boot AgentsModule first');
  }

  const prior = commerceStore
    .listRefunds()
    .filter((r) => r.orderId === input.orderId).length;

  return runtime.decide({
    name: MERIDIAN_REFUND_DECISION.name,
    objective: MERIDIAN_REFUND_DECISION.objective,
    state: {
      orderId: input.orderId,
      amount: input.amount,
      reason: input.reason,
      refundHistory: { count: prior },
    } satisfies MeridianRefundState,
    choices: MERIDIAN_REFUND_DECISION.choices,
    risk: 'high',
    provider: 'hazel-agent',
    strategy: 'human-required',
    context: {
      runId: input.runId,
      agentId: 'support-desk',
    },
  });
}

export async function resumeRefundDecision(input: {
  decisionId: string;
  runId: string;
  action: 'approve' | 'reject' | 'override';
  decision?: 'approve' | 'reject' | 'review';
  actor: string;
  reason?: string;
  execute?: boolean;
}): Promise<DecisionResult> {
  const runtime = shared;
  if (!runtime) {
    throw new Error('Decision Runtime not initialized — boot AgentsModule first');
  }
  return runtime.resumeFromHuman({
    decisionId: input.decisionId,
    runId: input.runId,
    action: input.action,
    decision: input.decision,
    actor: input.actor,
    reason: input.reason,
    execute: input.execute ?? true,
  });
}
