/**
 * WHY: One AgentRuntime for all Meridian specialists + Skillgate + DNA overlay.
 * Phase 6: optional SQL durable store, Flow HITL peer, RAG helpdesk.
 * Tool calls go through @hazeljs/agent-gatekeeper (authorizationGate).
 */

import * as path from 'path';
import { HazelModule, Service } from '@hazeljs/core';
import {
  AgentModule,
  AgentService,
  AgentRuntime,
  AgentEventType,
  PolicyEngine,
  defaultPiiMaskPolicies,
  CostOptimizer,
  GovernanceGate,
  defaultAgentGovernance,
  FileTimelineStore,
  type AgentContract,
  type AgentEvent,
  type AgentRuntimeConfig,
} from '@hazeljs/agent';
import { DemoLLMProvider } from '../llm/demo-llm.provider';
import { OpenAILLMProvider } from '../llm/openai-llm.provider';
import { SupportDeskAgent } from './support.agent';
import { SafeDeskAgent } from './safe.agent';
import { FraudTriageAgent } from './fraud.agent';
import { OpsRouterAgent } from './router.agent';
import { ApiConciergeAgent } from './api-concierge.agent';
import { HelpdeskAgent } from './helpdesk.agent';
import { applyDnaOverlays, formatOverlayReport } from '../platform/dna-overlay';
import { wireSkillgate, formatReport } from '../skillgate/wire-skills';
import { buildGateFromModule } from '../skillgate/build-gate';
import { createMeridianDurableStore, meridianDurableBackend } from '../durable/create-meridian-durable';
import { createOptionalFlowPeer } from '../flow/create-flow-peer';
import { helpdeskRag } from '../rag/helpdesk-kb';
import {
  bindGatekeeper,
  createMeridianGatekeeper,
  formatGatekeeperBoot,
  gatekeeperFor,
  type MeridianGatekeeperBundle,
} from '../gatekeeper';

export const supportContract: AgentContract = {
  name: 'support-desk-slo',
  maxLatencyMs: 120_000,
  fallbackAgent: 'safe-desk',
};

let pendingGatekeeper: MeridianGatekeeperBundle | undefined;

function attachGatekeeper(runtime: AgentRuntime): MeridianGatekeeperBundle | undefined {
  if (pendingGatekeeper) bindGatekeeper(runtime, pendingGatekeeper);
  return gatekeeperFor(runtime);
}

export function createAgentOsRuntimeConfig(): AgentRuntimeConfig {
  const llm = process.env.OPENAI_API_KEY ? new OpenAILLMProvider() : new DemoLLMProvider();

  const policyEngine = new PolicyEngine([
    ...defaultPiiMaskPolicies(),
    {
      id: 'refund-needs-approval',
      tool: 'processRefund',
      effect: 'require_approval',
      priority: 20,
      reason: 'Refunds require human approval',
    },
    {
      id: 'deny-refund-without-order',
      tool: 'processRefund',
      effect: 'deny',
      priority: 5,
      whenInputIncludes: '"orderId":""',
      reason: 'Missing order id',
    },
    {
      id: 'freeze-needs-approval',
      tool: 'freezeAccount',
      effect: 'require_approval',
      priority: 20,
      reason: 'Account freezes require human approval',
    },
  ]);

  const timelineFile =
    process.env.AGENT_OS_TIMELINE_FILE ?? path.join(process.cwd(), '.hazel', 'timeline.jsonl');
  const durable = createMeridianDurableStore();
  const flowEngine = createOptionalFlowPeer();
  const gatekeeper = createMeridianGatekeeper({ humanTasks: durable.humanTaskService });
  pendingGatekeeper = gatekeeper;

  if (process.env.JEST_WORKER_ID === undefined) {
    console.log(
      `Durable backend: ${meridianDurableBackend()}${flowEngine ? ' · Flow HITL peer: on' : ''}`
    );
    console.log(formatGatekeeperBoot(gatekeeper));
  }

  return {
    llmProvider: llm,
    defaultMaxSteps: 8,
    defaultTimeout: 120_000,
    enableMetrics: true,
    enableRetry: true,
    enableCircuitBreaker: false,
    policyEngine,
    authorizationGate: gatekeeper.enabled ? gatekeeper.authorizationGate : undefined,
    governanceGate: new GovernanceGate(defaultAgentGovernance()),
    costOptimizer: new CostOptimizer(),
    timelineStore: new FileTimelineStore(timelineFile),
    durableSuspend: true,
    runRepository: durable.runRepository,
    checkpointService: durable.checkpointService,
    humanTaskService: durable.humanTaskService,
    ragService: helpdeskRag as never,
    flowEngine: flowEngine as never,
  };
}

/** Auto-approve unless AGENT_OS_HITL=1 or SKILLGATE_HITL=1. */
export function wireDemoHitl(runtime: AgentRuntime): void {
  if (process.env.AGENT_OS_HITL === '1' || process.env.SKILLGATE_HITL === '1') return;
  runtime.on(AgentEventType.TOOL_APPROVAL_REQUESTED, (event) => {
    const data = (event as AgentEvent<{ requestId?: string }>).data;
    if (!data?.requestId) return;
    const requestId = data.requestId;
    const bundle = gatekeeperFor(runtime);
    void (async () => {
      let resumeId = requestId;
      if (bundle?.enabled) {
        await bundle.approvalProvider.resolve(requestId, 'approved', 'demo-auto-approver');
        const rec = await bundle.approvalProvider.get(requestId);
        if (rec?.runId) resumeId = rec.runId;
      }
      try {
        runtime.approveToolExecution(requestId, 'demo-auto-approver');
      } catch {
        /* durable path may not have an in-process waiter */
      }
      await runtime
        .approveAndResume(resumeId, {
          approved: true,
          approvedBy: 'demo-auto-approver',
        })
        .catch(() => {
          /* no durable run yet — in-process approve is enough */
        });
    })();
  });
}

function registerAllAgents(runtime: AgentRuntime): void {
  runtime.registerAgent(SupportDeskAgent);
  runtime.registerAgent(SafeDeskAgent);
  runtime.registerAgent(FraudTriageAgent);
  runtime.registerAgent(OpsRouterAgent);
  runtime.registerAgent(ApiConciergeAgent);
  runtime.registerAgent(HelpdeskAgent);
  runtime.registerAgentInstance('support-desk', new SupportDeskAgent());
  runtime.registerAgentInstance('safe-desk', new SafeDeskAgent());
  runtime.registerAgentInstance('fraud-triage', new FraudTriageAgent());
  runtime.registerAgentInstance('ops-router', new OpsRouterAgent());
  runtime.registerAgentInstance('api-concierge', new ApiConciergeAgent());
  runtime.registerAgentInstance('helpdesk', new HelpdeskAgent());
}

export function createStandaloneAgentOs(): AgentRuntime {
  const runtime = new AgentRuntime(createAgentOsRuntimeConfig());
  attachGatekeeper(runtime);
  registerAllAgents(runtime);
  wireDemoHitl(runtime);
  if (process.env.JEST_WORKER_ID === undefined) {
    const { report } = wireSkillgate(runtime, buildGateFromModule());
    console.log(formatReport(report));
    void applyDnaOverlays(runtime).then((r) => {
      if (r.enabled && r.applied.length) console.log(formatOverlayReport(r));
    });
  }
  return runtime;
}

export async function createStandaloneAgentOsWithOverlay(): Promise<AgentRuntime> {
  const runtime = new AgentRuntime(createAgentOsRuntimeConfig());
  attachGatekeeper(runtime);
  registerAllAgents(runtime);
  wireDemoHitl(runtime);
  const { report } = wireSkillgate(runtime, buildGateFromModule());
  console.log(formatReport(report));
  const overlay = await applyDnaOverlays(runtime);
  console.log(formatOverlayReport(overlay));
  return runtime;
}

AgentModule.forRoot({
  runtime: createAgentOsRuntimeConfig(),
});

@Service()
export class MeridianBootstrap {
  constructor(private readonly agents: AgentService) {
    // getRuntime() triggers AgentService discovery (registerAgent + tools + @Delegate patch).
    const runtime = this.agents.getRuntime();
    attachGatekeeper(runtime);
    wireDemoHitl(runtime);
    const { report } = wireSkillgate(runtime, buildGateFromModule());
    console.log(formatReport(report));
    void applyDnaOverlays(runtime).then((r) => console.log(formatOverlayReport(r)));
  }
}

@HazelModule({
  imports: [AgentModule],
  providers: [
    SupportDeskAgent,
    SafeDeskAgent,
    FraudTriageAgent,
    OpsRouterAgent,
    ApiConciergeAgent,
    HelpdeskAgent,
    MeridianBootstrap,
  ],
  exports: [AgentModule],
})
export class AgentsModule {}
