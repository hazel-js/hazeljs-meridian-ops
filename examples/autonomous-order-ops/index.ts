/**
 * Offline AAR lab — same OrderOperationsService path as POST /api/autonomous/*.
 *
 *   npm run example:autonomous
 */

import {
  createMeridianAutonomousRuntime,
  emitCarrierFailed,
  resumeAutonomousRun,
} from '../../src/autonomous/meridian-autonomous';
import { createMeridianGatekeeper } from '../../src/gatekeeper';
import { createMeridianDurableStore } from '../../src/durable/create-meridian-durable';
import { commerceStore } from '../../src/data/commerce.store';

async function main(): Promise<void> {
  console.log('\n— Meridian Autonomous Runtime (offline) —\n');

  const durable = createMeridianDurableStore();
  const gatekeeper = createMeridianGatekeeper({ humanTasks: durable.humanTaskService });
  const runtime = createMeridianAutonomousRuntime({
    gatekeeper: gatekeeper.enabled ? gatekeeper.gatekeeper : undefined,
  });
  await runtime.start();

  const before = commerceStore.getOrder('ORD-1001')?.carrier;
  console.log(`ORD-1001 carrier before: ${before}`);

  const { runId, run: pending } = await emitCarrierFailed({
    orderId: 'ORD-1001',
    carrier: before,
    source: 'offline-lab',
  });

  console.log(`Run ${runId} phase=${pending?.metadata.phase}`);
  console.log(`Decision: ${JSON.stringify(pending?.metadata.decision)}`);

  const done = await resumeAutonomousRun(runId, { approved: true, actor: 'ops-lead' });
  console.log(`After approve: status=${done?.status} carrier=${commerceStore.getOrder('ORD-1001')?.carrier}`);
  console.log(JSON.stringify({ output: done?.output, timeline: done?.metadata.timeline }, null, 2));
  console.log('\nLive twin after npm run dev: POST /api/autonomous/carrier-failed\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
