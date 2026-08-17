import { Controller, Get, Query } from '@hazeljs/core';
import { AgentService } from '@hazeljs/agent';
import { AGENT_NAME } from '../config';
import { buildGateFromModule } from '../skillgate/build-gate';
import { formatReport } from '../skillgate/wire-skills';
import { gatekeeperFor } from '../gatekeeper';

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

@Controller('/api/gatekeeper')
export class GatekeeperController {
  constructor(private readonly agents: AgentService) {}

  @Get('/status')
  status() {
    const bundle = gatekeeperFor(this.agents.getRuntime());
    if (!bundle) {
      return { enabled: false, reason: 'Gatekeeper not bound to this runtime' };
    }
    return {
      enabled: bundle.enabled,
      mode: bundle.gatekeeper.mode,
      defaultDecision: bundle.gatekeeper.defaultDecision,
      approvalBackend: bundle.approvalBackend,
      auditBackend: bundle.auditBackend,
      policies: bundle.policies.map((p) => ({
        id: p.id,
        version: p.version,
        priority: p.priority ?? 0,
        tools: p.match?.tools,
      })),
    };
  }
}
