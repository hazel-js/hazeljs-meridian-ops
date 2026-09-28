/**
 * Decision Runtime — refund-approval path (closed-set → HITL → Gatekeeper).
 */

import { createMeridianDurableStore } from '../src/durable/create-meridian-durable';
import { createMeridianGatekeeper } from '../src/gatekeeper';
import {
  createMeridianDecisionRuntime,
  decideRefund,
  getMeridianDecisionRuntime,
  resumeRefundDecision,
} from '../src/decision/meridian-decision';
import { commerceStore } from '../src/data/commerce.store';

describe('Meridian Decision Runtime', () => {
  beforeAll(() => {
    const durable = createMeridianDurableStore();
    const gatekeeper = createMeridianGatekeeper({ humanTasks: durable.humanTaskService });
    createMeridianDecisionRuntime({
      gatekeeper: gatekeeper.enabled ? gatekeeper.gatekeeper : undefined,
      checkpoints: durable.checkpointService,
      humanTasks: durable.humanTaskService,
    });
  });

  it('exposes a ready runtime', () => {
    expect(getMeridianDecisionRuntime()).toBeDefined();
  });

  it('pauses refund-approval for HITL then executes via Gatekeeper after override', async () => {
    const before = commerceStore.listRefunds().length;

    const pending = await decideRefund({
      orderId: 'ORD-1001',
      amount: 50,
      reason: 'decision test',
    });

    expect(pending.status).toBe('WAITING_FOR_HUMAN');
    expect(pending.hitl?.required).toBe(true);
    expect(commerceStore.listRefunds().length).toBe(before);

    const resumed = await resumeRefundDecision({
      decisionId: pending.id,
      runId: pending.trace.runId!,
      action: 'override',
      decision: 'approve',
      actor: 'ops-lead',
      reason: 'Verified customer',
      execute: true,
    });

    expect(resumed.hitl?.status).toBe('overridden');
    expect(resumed.execution?.authorized).toBe(true);
    expect(resumed.execution?.invoked).toBe(true);
    expect(commerceStore.listRefunds().length).toBe(before + 1);

    // Cold-start: clear memory, resume again — no double refund.
    getMeridianDecisionRuntime()!.clearMemory();
    const again = await resumeRefundDecision({
      decisionId: pending.id,
      runId: pending.trace.runId!,
      action: 'approve',
      actor: 'ops-lead',
      execute: true,
    });
    expect(again.execution?.receiptId).toBeDefined();
    expect(commerceStore.listRefunds().length).toBe(before + 1);
  });
});
