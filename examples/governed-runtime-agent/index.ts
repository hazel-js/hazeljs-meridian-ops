/**
 * Offline governed runtime lab — external harness mediation without AgentRuntime.
 *
 * TrustedCallerContext (server-built) → Gatekeeper → HITL → ledger → dispatch.
 *
 * From hazeljs-meridian-ops:
 *   npm run example:governed-runtime
 */
import {
  createAgentGatekeeperBundle,
  createGovernedRuntime,
  createGovernedToolExecutor,
  LocalRuntimeAdapter,
  MemoryDistributedLock,
  MemoryGovernedRunStore,
  MemoryToolAttemptLedger,
  type ProtectedTool,
  type TrustedCallerContext,
} from '@hazeljs/agent-gatekeeper';

const refunds: Array<{ orderId: string; amount: number }> = [];

const processRefund: ProtectedTool<{ orderId: string; amount: number }, { ok: true }> = {
  name: 'processRefund',
  description: 'Issue a refund (HITL)',
  classification: 'destructive',
  riskLevel: 'critical',
  execute: async (input) => {
    refunds.push(input);
    return { ok: true };
  },
};

async function main(): Promise<void> {
  console.log('Meridian governed runtime lab (in-memory lock/ledger/run store — no Redis)');

  const bundle = createAgentGatekeeperBundle({
    policies: [
      {
        id: 'refund-needs-approval',
        version: '1.0.0',
        priority: 50,
        match: { tools: ['processRefund'] },
        rules: { requireApprovalWhen: () => true },
      },
    ],
    mode: 'enforce',
    defaultDecision: 'deny',
    tenantId: 'meridian',
    environment: 'lab',
  });

  const tools = new Map<string, ProtectedTool>([['processRefund', processRefund]]);
  const toolExecutor = createGovernedToolExecutor({
    gatekeeper: bundle.gatekeeper,
    approvals: bundle.approvalProvider,
    lock: new MemoryDistributedLock(),
    ledger: new MemoryToolAttemptLedger(),
    tools,
    dispatch: async (toolName, input) => {
      const tool = tools.get(toolName);
      if (!tool) throw new Error(`Unknown tool ${toolName}`);
      return tool.execute(input as never, {} as never);
    },
  });

  const runtime = createGovernedRuntime({
    adapter: new LocalRuntimeAdapter(),
    runStore: new MemoryGovernedRunStore(),
    toolExecutor,
  });

  const caller: TrustedCallerContext = {
    tenantId: 'meridian',
    actorId: 'ops-lead',
    runId: 'run_lab_1',
    policyVersion: 'lab-1',
    capabilities: ['payments.refund'],
    environment: 'lab',
    trustLevel: 'high',
  };

  const started = await runtime.start(caller, { intent: 'refund ORD-1001' });
  console.log(`\nStarted run ${started.runId} via adapter=${started.adapter}`);

  const pending = await runtime.executeTool(caller, {
    toolName: 'processRefund',
    input: { orderId: 'ORD-1001', amount: 50 },
    classification: 'destructive',
    idempotencyKey: 'refund:ORD-1001:50',
  });
  console.log(
    `First call: ${pending.outcome}`,
    pending.approvalId ? `(approval ${pending.approvalId})` : ''
  );
  console.log(`Refunds executed so far: ${refunds.length}`);

  if (pending.outcome !== 'require_approval' || !pending.approvalId) {
    throw new Error('Expected require_approval on first processRefund');
  }

  // Human approves → resolve pending approval, then retry with approvalToken = approvalId.
  await bundle.approvalProvider.resolve(pending.approvalId, 'approved', 'ops-lead');

  const done = await runtime.executeTool(caller, {
    toolName: 'processRefund',
    input: { orderId: 'ORD-1001', amount: 50 },
    classification: 'destructive',
    idempotencyKey: 'refund:ORD-1001:50',
    approvalToken: pending.approvalId,
  });
  console.log(`After approve: ${done.outcome}`, done.result ?? done.reason);
  console.log(`Refunds executed: ${JSON.stringify(refunds)}`);

  // Same idempotency key after a second HITL cycle → ledger returns duplicate (no double refund).
  const again = await runtime.executeTool(caller, {
    toolName: 'processRefund',
    input: { orderId: 'ORD-1001', amount: 50 },
    classification: 'destructive',
    idempotencyKey: 'refund:ORD-1001:50',
  });
  if (again.outcome !== 'require_approval' || !again.approvalId) {
    throw new Error('Expected require_approval on retry without token');
  }
  await bundle.approvalProvider.resolve(again.approvalId, 'approved', 'ops-lead');
  const dup = await runtime.executeTool(caller, {
    toolName: 'processRefund',
    input: { orderId: 'ORD-1001', amount: 50 },
    classification: 'destructive',
    idempotencyKey: 'refund:ORD-1001:50',
    approvalToken: again.approvalId,
  });
  console.log(`Retry same key: ${dup.outcome} (refunds still ${refunds.length})`);

  console.log('\nDone. Live Agent OS path still uses AgentRuntime + Gatekeeper (npm run dev).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
