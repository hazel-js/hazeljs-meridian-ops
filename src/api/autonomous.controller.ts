/**
 * Teaching API for Autonomous Application Runtime (AAR).
 * Observe carrier.failed → decide → HITL → Gatekeeper → shipping.switch.
 */

import { ApiTags, Body, Controller, Get, Param, Post } from '@hazeljs/core';
import {
  emitCarrierFailed,
  getMeridianAutonomousRuntime,
  resumeAutonomousRun,
  ALLOWED_FALLBACKS,
  APPROVAL_COST_THRESHOLD,
  MAX_ADDITIONAL_COST,
} from '../autonomous/meridian-autonomous';

@ApiTags('autonomous')
@Controller('/api/autonomous')
export class AutonomousController {
  @Get('/status')
  status() {
    const runtime = getMeridianAutonomousRuntime();
    const services = runtime?.registry.listServices() ?? [];
    return {
      ready: Boolean(runtime),
      package: '@hazeljs/autonomous',
      services: services.map((s) => ({ id: s.id, mode: s.mode, capabilities: s.capabilities })),
      capabilities: runtime?.registry.listCapabilities().map((c) => ({
        id: c.id,
        effect: c.effect,
        granted: c.granted,
      })),
      policy: {
        allowedFallbacks: [...ALLOWED_FALLBACKS],
        maxAdditionalCost: MAX_ADDITIONAL_COST,
        approvalCostThreshold: APPROVAL_COST_THRESHOLD,
      },
      note: 'Observation ≠ Decision ≠ Authorization ≠ Execution. AAR proposes; Gatekeeper authorizes.',
    };
  }

  /**
   * Emit carrier.failed observation. Mode is approval-required → parks until resume.
   */
  @Post('/carrier-failed')
  async carrierFailed(
    @Body()
    body: {
      orderId?: string;
      carrier?: string;
    }
  ) {
    if (!body?.orderId?.trim()) return { error: 'orderId is required' };

    try {
      const { runId, run } = await emitCarrierFailed({
        orderId: body.orderId,
        carrier: body.carrier,
      });
      return {
        runId,
        status: run?.status,
        phase: run?.metadata.phase,
        decision: run?.metadata.decision,
        approvalId: run?.metadata.approvalId,
        next:
          run?.metadata.phase === 'approval_pending'
            ? {
                resume: `POST /api/autonomous/runs/${runId}/resume`,
                body: { approved: true, actor: 'ops-lead' },
              }
            : undefined,
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  @Post('/runs/:runId/resume')
  async resume(
    @Param('runId') runId: string,
    @Body()
    body: {
      approved?: boolean;
      actor?: string;
    }
  ) {
    if (typeof body?.approved !== 'boolean') {
      return { error: 'approved (boolean) is required' };
    }
    if (!body?.actor?.trim()) return { error: 'actor is required' };

    try {
      const run = await resumeAutonomousRun(runId, {
        approved: body.approved,
        actor: body.actor.trim(),
      });
      return {
        runId,
        status: run?.status,
        phase: run?.metadata.phase,
        output: run?.output,
        error: run?.error,
        effectStatus: run?.metadata.effectStatus,
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  @Get('/runs/:runId')
  async inspect(@Param('runId') runId: string) {
    const runtime = getMeridianAutonomousRuntime();
    if (!runtime) return { error: 'Autonomous Runtime not initialized' };
    const run = await runtime.inspect(runId);
    if (!run) return { error: `Run not found: ${runId}` };
    return {
      runId: run.id,
      status: run.status,
      phase: run.metadata.phase,
      decision: run.metadata.decision,
      capabilityId: run.metadata.capabilityId,
      output: run.output,
      error: run.error,
      effectStatus: run.metadata.effectStatus,
      timeline: run.metadata.timeline,
    };
  }

  @Get('/runs/:runId/timeline')
  async timeline(@Param('runId') runId: string) {
    const runtime = getMeridianAutonomousRuntime();
    if (!runtime) return { error: 'Autonomous Runtime not initialized' };
    return { runId, timeline: await runtime.timeline(runId) };
  }
}
