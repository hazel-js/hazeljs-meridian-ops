import * as fs from 'fs';
import * as path from 'path';
import {
  AgentGatekeeper,
  InMemoryAuditSink,
  loadPoliciesFromFileSync,
  type ToolInvocationContext,
} from '@hazeljs/agent-gatekeeper';
import { createMeridianPolicies } from '../src/gatekeeper/policies';
import { createMeridianGatekeeper } from '../src/gatekeeper/create-gatekeeper';

function ctx(
  toolName: string,
  input: Record<string, unknown>,
  agentId = 'support-desk'
): ToolInvocationContext {
  return {
    invocationId: 'inv-test',
    runId: 'run-test',
    agentId,
    tenantId: 'meridian',
    toolName,
    input,
    environment: 'development',
    timestamp: new Date(),
  };
}

describe('Meridian Agent Gatekeeper', () => {
  const auditSink = new InMemoryAuditSink();
  const gatekeeper = new AgentGatekeeper({
    mode: 'enforce',
    defaultDecision: 'deny',
    policies: createMeridianPolicies(),
    auditSink,
  });

  it('allows catalog reads', async () => {
    const decision = await gatekeeper.evaluate(ctx('lookupOrder', { orderId: 'ORD-1001' }));
    expect(decision.outcome).toBe('allow');
  });

  it('requires approval for processRefund', async () => {
    const decision = await gatekeeper.evaluate(
      ctx('processRefund', { orderId: 'ORD-1002', amount: 40 })
    );
    expect(decision.outcome).toBe('require_approval');
  });

  it('denies refunds without an order id', async () => {
    const decision = await gatekeeper.evaluate(ctx('processRefund', { orderId: '', amount: 10 }));
    expect(decision.outcome).toBe('deny');
  });

  it('requires approval for freezeAccount', async () => {
    const decision = await gatekeeper.evaluate(
      ctx('freezeAccount', { accountId: 'ACC-RISK', reason: 'fraud' }, 'fraud-triage')
    );
    expect(decision.outcome).toBe('require_approval');
  });

  it('default-denies unknown tools', async () => {
    const decision = await gatekeeper.evaluate(ctx('deleteEverything', {}));
    expect(decision.outcome).toBe('deny');
  });

  it('allows router delegates', async () => {
    const decision = await gatekeeper.evaluate(
      ctx('support-desk', { input: 'Where is ORD-1001?' }, 'ops-router')
    );
    expect(decision.outcome).toBe('allow');
  });

  it('validates agent-gatekeeper.yaml', () => {
    const file = path.join(process.cwd(), 'agent-gatekeeper.yaml');
    expect(fs.existsSync(file)).toBe(true);
    const loaded = loadPoliciesFromFileSync(fs, file);
    expect(loaded.mode).toBe('enforce');
    expect(loaded.defaultDecision).toBe('deny');
    expect(loaded.policies.map((p) => p.id)).toEqual(
      expect.arrayContaining([
        'allow-catalog-reads',
        'refund-needs-approval',
        'freeze-needs-approval',
        'deny-refund-without-order',
      ])
    );
  });

  it('createMeridianGatekeeper is enforce + deny when enabled', () => {
    const prev = process.env.AGENT_OS_GATEKEEPER;
    delete process.env.AGENT_OS_GATEKEEPER;
    const bundle = createMeridianGatekeeper({});
    expect(bundle.enabled).toBe(true);
    expect(bundle.gatekeeper.mode).toBe('enforce');
    expect(bundle.gatekeeper.defaultDecision).toBe('deny');
    expect(bundle.approvalBackend).toBe('memory');
    if (prev === undefined) delete process.env.AGENT_OS_GATEKEEPER;
    else process.env.AGENT_OS_GATEKEEPER = prev;
  });
});
