/**
 * Meridian Autonomous Application Runtime — carrier failure → decide → approve → switch.
 * Ordinary @Injectable service (not @Agent). Decisions propose; Gatekeeper authorizes.
 */

import { Injectable } from '@hazeljs/core';
import {
  Autonomous,
  Observe,
  Capability,
  clearAutonomousRegistry,
  AutonomousRuntime,
  MemoryAutonomousRunStore,
  type AutonomousRunRecord,
} from '@hazeljs/autonomous';
import { commerceStore } from '../data/commerce.store';
import { meridianTenantId } from '../config';

export const ALLOWED_FALLBACKS = ['FedEx', 'DHL'] as const;
export const MAX_ADDITIONAL_COST = 5;
export const APPROVAL_COST_THRESHOLD = 2;

/** Demo fallback costs by order — mirrors teaching fixtures in @hazeljs/autonomous. */
const FALLBACK_COST: Record<string, number> = {
  'ORD-1001': 3,
  'ORD-1002': 1,
  'ORD-1003': 4,
};

@Injectable()
@Autonomous({
  id: 'order-operations',
  objective: 'Maintain reliable order processing when primary carrier fails',
  mode: 'approval-required',
  capabilities: ['shipping.inspect', 'shipping.switch'],
  policies: ['never-exceed-order-budget', 'allowed-fallback-carriers'],
  limits: { maxConcurrentRuns: 5, maxDecisionsPerHour: 100 },
  loopProtection: { maxDepth: 5, cooldownMs: 1000, maxActionsPerRun: 10 },
  recovery: { retry: { attempts: 2, backoff: 'exponential' } },
})
export class OrderOperationsService {
  @Observe('carrier.failed')
  onCarrierFailure(event: { orderId: string; carrier?: string }) {
    const orderId = event.orderId.toUpperCase();
    const order = commerceStore.getOrder(orderId);
    const cost = FALLBACK_COST[orderId] ?? 3;
    return {
      orderId,
      failedCarrier: event.carrier ?? order?.carrier ?? 'unknown',
      additionalCost: cost,
      candidate: ALLOWED_FALLBACKS[0],
      orderFound: Boolean(order),
      status: order?.status,
    };
  }

  @Capability({
    id: 'shipping.inspect',
    effect: 'read-only',
    approval: 'auto',
  })
  inspect(input: { orderId: string }) {
    const order = commerceStore.getOrder(input.orderId);
    return order ?? null;
  }

  @Capability({
    id: 'shipping.switch',
    effect: 'idempotent',
    approval: 'auto',
    idempotencyKey: true,
  })
  switchCarrier(input: { orderId: string; candidate?: string; additionalCost?: number }) {
    const candidate = input.candidate ?? ALLOWED_FALLBACKS[0];
    const cost = input.additionalCost ?? 0;
    if (!ALLOWED_FALLBACKS.includes(candidate as (typeof ALLOWED_FALLBACKS)[number])) {
      throw new Error(`Carrier ${candidate} not allowed`);
    }
    if (cost > MAX_ADDITIONAL_COST) {
      throw new Error(`Additional cost ${cost} exceeds budget ${MAX_ADDITIONAL_COST}`);
    }
    const result = commerceStore.switchCarrier(input.orderId, candidate, cost);
    if ('error' in result) throw new Error(result.error);
    return result;
  }
}

let shared: AutonomousRuntime | undefined;

export function getMeridianAutonomousRuntime(): AutonomousRuntime | undefined {
  return shared;
}

export function createMeridianAutonomousRuntime(opts: {
  /** Shared Meridian Gatekeeper instance (same process as AgentRuntime). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gatekeeper?: any;
}): AutonomousRuntime {
  clearAutonomousRegistry();

  const runtime = new AutonomousRuntime({
    storage: new MemoryAutonomousRunStore(),
    autoDiscover: false,
    services: [OrderOperationsService],
    gatekeeper: opts.gatekeeper,
    resolveTenantId: () => meridianTenantId(),
    decisionEngine: {
      async evaluate(ctx) {
        const payload = ctx.observation.payload as {
          orderId: string;
          additionalCost?: number;
          candidate?: string;
          orderFound?: boolean;
        };

        if (payload.orderFound === false) {
          return { type: 'no-action', reason: `Unknown order ${payload.orderId}` };
        }

        const cost = payload.additionalCost ?? 0;
        if (cost > MAX_ADDITIONAL_COST) {
          return { type: 'no-action', reason: 'Exceeds maximumAdditionalShippingCost' };
        }

        const args = {
          orderId: payload.orderId,
          candidate: payload.candidate ?? ALLOWED_FALLBACKS[0],
          additionalCost: cost,
        };

        if (cost > APPROVAL_COST_THRESHOLD || ctx.mode === 'approval-required') {
          return {
            type: 'request-approval',
            capabilityId: 'shipping.switch',
            arguments: args,
            reason: `Fallback carrier within policy; approval required (cost=${cost})`,
          };
        }

        return {
          type: 'execute',
          capabilityId: 'shipping.switch',
          arguments: args,
          reason: 'Fallback within auto threshold',
        };
      },
    },
  });

  runtime.bindInstance(OrderOperationsService, new OrderOperationsService());
  shared = runtime;
  return runtime;
}

export async function emitCarrierFailed(input: {
  orderId: string;
  carrier?: string;
  source?: string;
}): Promise<{ runId: string; run: AutonomousRunRecord | undefined }> {
  const runtime = getMeridianAutonomousRuntime();
  if (!runtime) throw new Error('Autonomous Runtime not initialized');

  const [runId] = await runtime.emit(
    'carrier.failed',
    { orderId: input.orderId.trim(), carrier: input.carrier },
    {
      tenantId: meridianTenantId(),
      source: input.source ?? 'api',
      subject: input.orderId.trim().toUpperCase(),
    }
  );

  if (!runId) throw new Error('No autonomous run created for carrier.failed');
  const run = await runtime.inspect(runId);
  return { runId, run };
}

export async function resumeAutonomousRun(
  runId: string,
  approval: { approved: boolean; actor: string }
): Promise<AutonomousRunRecord | undefined> {
  const runtime = getMeridianAutonomousRuntime();
  if (!runtime) throw new Error('Autonomous Runtime not initialized');
  await runtime.resume(runId, approval);
  return runtime.inspect(runId);
}
