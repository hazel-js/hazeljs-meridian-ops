/**
 * Teaching API for Decision Runtime + Decision Plane.
 * Runtime: closed-set refund → HITL → Gatekeeper. Plane: finite harness-neutral answers.
 */

import { ApiTags, Body, Controller, Get, Param, Post } from '@hazeljs/core';
import {
  decideRefund,
  getMeridianDecisionRuntime,
  resumeRefundDecision,
} from '../decision/meridian-decision';
import {
  decideModelRoute,
  inferRouteContext,
  MERIDIAN_MODEL_ROUTE,
} from '../decision/meridian-decision-plane';

@ApiTags('decision')
@Controller('/api/decision')
export class DecisionController {
  @Get('/status')
  status() {
    const runtime = getMeridianDecisionRuntime();
    return {
      ready: Boolean(runtime),
      package: '@hazeljs/decision',
      definitions: runtime ? ['refund-approval'] : [],
      plane: {
        definitions: [MERIDIAN_MODEL_ROUTE.id],
        note: 'Decision Plane is advisory finite answers — it does not replace DecisionRuntime or Gatekeeper.',
      },
      note: 'Confidence informs policy; Gatekeeper authorizes payments.refund. Confidence ≠ permission.',
    };
  }

  /**
   * Decision Plane model-route lab. Body: `{ message }` or explicit `{ routine, policyFaq, moneyMove }`.
   */
  @Post('/plane/route')
  async planeRoute(
    @Body()
    body: {
      message?: string;
      routine?: boolean;
      policyFaq?: boolean;
      moneyMove?: boolean;
      tenantId?: string;
      actorId?: string;
    }
  ) {
    const context = body?.message?.trim()
      ? inferRouteContext(body.message.trim())
      : {
          routine: Boolean(body?.routine),
          policyFaq: Boolean(body?.policyFaq),
          moneyMove: Boolean(body?.moneyMove),
        };

    try {
      const result = await decideModelRoute(context, {
        tenantId: body?.tenantId,
        actorId: body?.actorId,
      });
      return {
        plane: MERIDIAN_MODEL_ROUTE.id,
        context,
        status: result.status,
        answer: result.status === 'succeeded' ? result.answer : undefined,
        summary: result.summary,
        reason: result.status !== 'succeeded' ? result.reason : undefined,
        confidence: result.confidence,
        next:
          result.status === 'succeeded' && result.answer === 'advanced'
            ? {
                hint: 'Money-moving intent — use Decision Runtime + Gatekeeper, not Plane alone',
                refund: 'POST /api/decision/refund',
              }
            : undefined,
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Closed-set refund judgment. Always enters Decision HITL (human-required).
   * Resume with POST /api/decision/refund/:decisionId/resume to execute via Gatekeeper.
   */
  @Post('/refund')
  async refund(
    @Body()
    body: {
      orderId?: string;
      amount?: number;
      reason?: string;
      runId?: string;
    }
  ) {
    if (!body?.orderId?.trim()) return { error: 'orderId is required' };
    if (typeof body.amount !== 'number' || !(body.amount > 0)) {
      return { error: 'amount must be a positive number' };
    }

    try {
      const result = await decideRefund({
        orderId: body.orderId.trim(),
        amount: body.amount,
        reason: body.reason,
        runId: body.runId,
      });
      return {
        decisionId: result.id,
        runId: result.trace.runId,
        decision: result.decision,
        confidence: result.confidence,
        status: result.status,
        policy: result.policy,
        hitl: result.hitl,
        risk: result.risk,
        next:
          result.status === 'WAITING_FOR_HUMAN'
            ? {
                resume: `POST /api/decision/refund/${result.id}/resume`,
                body: {
                  runId: result.trace.runId,
                  action: 'override',
                  decision: 'approve',
                  actor: 'ops-lead',
                  execute: true,
                },
              }
            : undefined,
      };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  @Post('/refund/:decisionId/resume')
  async resume(
    @Param('decisionId') decisionId: string,
    @Body()
    body: {
      runId?: string;
      action?: 'approve' | 'reject' | 'override';
      decision?: 'approve' | 'reject' | 'review';
      actor?: string;
      reason?: string;
      execute?: boolean;
    }
  ) {
    if (!body?.runId?.trim()) return { error: 'runId is required' };
    if (!body?.action) return { error: 'action is required (approve | reject | override)' };
    if (!body?.actor?.trim()) return { error: 'actor is required' };

    try {
      const result = await resumeRefundDecision({
        decisionId,
        runId: body.runId.trim(),
        action: body.action,
        decision: body.decision,
        actor: body.actor.trim(),
        reason: body.reason,
        execute: body.execute ?? true,
      });
      return {
        decisionId: result.id,
        runId: result.trace.runId,
        decision: result.decision,
        status: result.status,
        policy: result.policy,
        hitl: result.hitl,
        execution: result.execution,
      };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
