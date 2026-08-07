import { Controller, Get, Query } from '@hazeljs/core';
import { AgentService } from '@hazeljs/agent';
import { AGENT_NAME } from '../config';
import { buildGateFromModule } from '../skillgate/build-gate';
import { formatReport } from '../skillgate/wire-skills';

@Controller('/api/skillgate')
export class ReportController {
  constructor(private readonly agents: AgentService) {}

  /** Live Skillgate governance report (included / denied / warnings). */
  @Get('/report')
  report(@Query('json') json?: string) {
    const gate = buildGateFromModule();
    const report = gate.report();
    if (json === '1' || json === 'true') return report;
    return { text: formatReport(report), report };
  }

  /** Tools currently registered on the api-concierge agent. */
  @Get('/tools')
  tools() {
    const tools = this.agents.getRuntime().getAgentTools(AGENT_NAME);
    return {
      agent: AGENT_NAME,
      count: tools.length,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        requiresApproval: t.requiresApproval,
        readOnly: t.readOnly,
        capability: t.capability,
        riskLevel: t.riskLevel,
        metadata: t.metadata,
      })),
    };
  }
}
