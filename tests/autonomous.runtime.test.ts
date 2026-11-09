/**
 * Autonomous Application Runtime — carrier.failed → HITL → shipping.switch.
 */

import { createMeridianDurableStore } from '../src/durable/create-meridian-durable';
import { createMeridianGatekeeper } from '../src/gatekeeper';
import {
  createMeridianAutonomousRuntime,
  emitCarrierFailed,
  getMeridianAutonomousRuntime,
  resumeAutonomousRun,
} from '../src/autonomous/meridian-autonomous';
import { commerceStore } from '../src/data/commerce.store';

describe('Meridian Autonomous Runtime', () => {
  beforeAll(async () => {
    const durable = createMeridianDurableStore();
    const gatekeeper = createMeridianGatekeeper({ humanTasks: durable.humanTaskService });
    const runtime = createMeridianAutonomousRuntime({
      gatekeeper: gatekeeper.enabled ? gatekeeper.gatekeeper : undefined,
    });
    await runtime.start();
  });

  it('exposes a ready runtime with order-operations', () => {
    const runtime = getMeridianAutonomousRuntime();
    expect(runtime).toBeDefined();
    expect(runtime!.registry.getService('order-operations')?.mode).toBe('approval-required');
    expect(runtime!.registry.getCapability('shipping.switch')?.granted).toBe(true);
  });

  it('parks on carrier.failed then switches carrier after approval', async () => {
    const before = commerceStore.getOrder('ORD-1001')!.carrier;

    const { runId, run: pending } = await emitCarrierFailed({
      orderId: 'ORD-1001',
      carrier: before,
    });

    expect(pending?.metadata.phase).toBe('approval_pending');
    expect(pending?.metadata.decision?.type).toBe('request-approval');
    expect(commerceStore.getOrder('ORD-1001')!.carrier).toBe(before);

    const completed = await resumeAutonomousRun(runId, {
      approved: true,
      actor: 'ops-lead',
    });

    expect(completed?.status).toBe('completed');
    expect(completed?.metadata.effectStatus).toBe('succeeded');
    expect(commerceStore.getOrder('ORD-1001')!.carrier).toBe('FedEx');
    expect(completed?.output).toMatchObject({
      switched: true,
      orderId: 'ORD-1001',
      newCarrier: 'FedEx',
    });
  });

  it('rejects approval without switching', async () => {
    const before = commerceStore.getOrder('ORD-1002')!.carrier;
    const { runId } = await emitCarrierFailed({
      orderId: 'ORD-1002',
      carrier: before,
    });

    const cancelled = await resumeAutonomousRun(runId, {
      approved: false,
      actor: 'ops-lead',
    });

    expect(cancelled?.status).toBe('cancelled');
    expect(commerceStore.getOrder('ORD-1002')!.carrier).toBe(before);
  });
});
