/**
 * Meridian Decision Plane — finite answers for harness-neutral routing.
 * Does not replace DecisionRuntime (refund-approval HITL path).
 */

import {
  createDecisionPlane,
  createRulesPlaneProvider,
  defineDecision,
  type DecisionPlane,
  type PlaneResult,
} from '@hazeljs/decision';

/** Advisory model/desk route before tools — confidence still ≠ permission. */
export const MERIDIAN_MODEL_ROUTE = defineDecision({
  id: 'meridian.model-route',
  version: '1',
  answers: ['fast', 'balanced', 'advanced', 'abstain'] as const,
  criteria: {
    fast: 'Routine factual / tracking question',
    balanced: 'Ambiguous intent or light policy FAQ',
    advanced: 'Consequential refund / freeze recommendation',
    abstain: 'Insufficient evidence to route',
  },
  strategy: { providers: ['rules'], onFailure: 'abstain' },
});

export type MeridianRouteContext = {
  routine?: boolean;
  policyFaq?: boolean;
  moneyMove?: boolean;
  message?: string;
};

let plane: DecisionPlane | undefined;

export function getMeridianDecisionPlane(): DecisionPlane {
  if (!plane) {
    plane = createDecisionPlane({
      providers: [
        createRulesPlaneProvider({
          rules: [
            {
              answer: 'advanced',
              when: (c) => Boolean((c as MeridianRouteContext).moneyMove),
              summary: 'Money-moving intent → advanced / HITL path',
            },
            {
              answer: 'fast',
              when: (c) => Boolean((c as MeridianRouteContext).routine),
              summary: 'Routine factual → fast desk',
            },
            {
              answer: 'balanced',
              when: (c) => Boolean((c as MeridianRouteContext).policyFaq),
              summary: 'Policy FAQ → balanced / helpdesk',
            },
          ],
          onNoMatch: 'abstain',
        }),
      ],
    });
  }
  return plane;
}

/** Infer a cheap route context from free text (demo heuristics). */
export function inferRouteContext(message: string): MeridianRouteContext {
  const m = message.toLowerCase();
  const moneyMove =
    m.includes('refund') || m.includes('freeze') || m.includes('chargeback');
  const policyFaq =
    m.includes('sla') || m.includes('policy') || m.includes('hours') || m.includes('return');
  const routine =
    !moneyMove &&
    (m.includes('track') || m.includes('where is') || m.includes('status') || m.includes('ord-'));
  return { message, moneyMove, policyFaq, routine };
}

export async function decideModelRoute(
  context: MeridianRouteContext,
  opts?: { tenantId?: string; actorId?: string }
): Promise<PlaneResult> {
  return getMeridianDecisionPlane().decide({
    definition: MERIDIAN_MODEL_ROUTE,
    context,
    execution: {
      tenantId: opts?.tenantId ?? 'meridian',
      actorId: opts?.actorId ?? 'ops-router',
      permissionScope: 'support',
      policyVersion: 'meridian-plane-1',
    },
  });
}
