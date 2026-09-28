import { Controller, Get, Param, Post, Query } from '@hazeljs/core';
import { AgentService } from '@hazeljs/agent';
import { runTravelSpeculationDemo } from '@hazeljs/agent-vm';
import { agentVmFor } from '../agent-vm';

@Controller('/api/agent-vm')
export class AgentVmController {
  constructor(private readonly agents: AgentService) {}

  @Get('/status')
  status() {
    const bundle = agentVmFor(this.agents.getRuntime());
    if (!bundle?.enabled) {
      return { enabled: false, reason: 'Set AGENT_OS_AGENT_VM=1 to enable effect typing and speculation' };
    }
    const quarantine = bundle.vm.coordinator.getQuarantineStore().list();
    return {
      enabled: true,
      barrierMode: bundle.barrierMode,
      storeBuffer: process.env.AGENT_OS_AGENT_VM_STORE_BUFFER === '1',
      quarantineCount: Array.isArray(quarantine) ? quarantine.length : 0,
      effectTools: this.agents
        .getRuntime()
        .getAgentTools('support-desk')
        .map((t) => ({
          name: t.name,
          readOnly: t.readOnly,
          requiresApproval: t.requiresApproval,
        })),
    };
  }

  @Get('/runs/:runId/journal')
  async journal(@Param('runId') runId: string) {
    const bundle = agentVmFor(this.agents.getRuntime());
    if (!bundle?.enabled) return { enabled: false, entries: [] };
    const entries = await bundle.vm.journal.listRun(runId);
    return {
      runId,
      count: entries.length,
      entries: entries.map((e) => ({
        id: e.id,
        toolName: e.toolName,
        branchId: e.branchId,
        status: e.status,
        createdAt: e.createdAt,
      })),
    };
  }

  @Post('/runs/:runId/undo')
  async undo(@Param('runId') runId: string) {
    const bundle = agentVmFor(this.agents.getRuntime());
    if (!bundle?.enabled) {
      return { error: 'Agent VM disabled — set AGENT_OS_AGENT_VM=1' };
    }
    const result = await bundle.vm.coordinator.undoRun(runId);
    return result;
  }

  /** Lab: three-branch travel holds — winner commits, losers compensate. */
  @Post('/speculate/travel')
  async travelSpeculate(@Query('branches') branches?: string) {
    const n = Math.min(8, Math.max(2, parseInt(branches ?? '3', 10) || 3));
    return runTravelSpeculationDemo(n);
  }
}
