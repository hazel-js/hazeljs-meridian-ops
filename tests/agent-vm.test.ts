import { commerceStore } from '../src/data/commerce.store';
import { runTravelSpeculationDemo } from '@hazeljs/agent-vm';
import { attachAgentVm, agentVmFor } from '../src/agent-vm/create-agent-vm';
import { createStandaloneAgentOs } from '../src/agents/agents.module';

describe('Meridian Agent VM', () => {
  it('reverseRefund restores order status', () => {
    const before = commerceStore.getOrder('ORD-1002');
    expect(before?.status).toBe('delivered');
    const created = commerceStore.createRefund('ORD-1002', 20, 'test');
    expect('id' in created).toBe(true);
    if (!('id' in created)) return;
    expect(commerceStore.getOrder('ORD-1002')?.status).toBe('refunded');
    const undone = commerceStore.reverseRefund(created.id);
    expect(undone.reversed).toBe(true);
    expect(commerceStore.getOrder('ORD-1002')?.status).toBe('delivered');
  });

  it('travel speculation releases losing branch holds', async () => {
    const result = await runTravelSpeculationDemo(3);
    expect(result.rolledBackBranches).toHaveLength(2);
    expect(result.activeHolds).toBe(1);
    expect(result.releasedHolds).toBe(2);
  });

  it('attachAgentVm wires package helpers when AGENT_OS_AGENT_VM=1', () => {
    const prev = process.env.AGENT_OS_AGENT_VM;
    process.env.AGENT_OS_AGENT_VM = '1';
    const runtime = createStandaloneAgentOs();
    const bundle = attachAgentVm(runtime);
    expect(bundle?.enabled).toBe(true);
    expect(bundle?.vm.effectGate).toBeDefined();
    expect(agentVmFor(runtime)?.vm).toBe(bundle?.vm);
    if (prev === undefined) delete process.env.AGENT_OS_AGENT_VM;
    else process.env.AGENT_OS_AGENT_VM = prev;
  });
});
