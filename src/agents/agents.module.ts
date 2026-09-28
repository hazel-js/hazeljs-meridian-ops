/**
 * WHY: One AgentRuntime for all Meridian specialists + Skillgate + DNA overlay.
 * Phase 6: optional SQL durable store, Flow HITL peer, RAG helpdesk.
 * Tool calls go through @hazeljs/agent-gatekeeper (authorizationGate).
 * Optional @hazeljs/agent-vm (AGENT_OS_AGENT_VM=1) for effect typing and rollback.
 */

import * as path from 'path';
import { HazelModule, Service } from '@hazeljs/core';
import {
  AgentModule,
  AgentService,
  AgentRuntime,
  PolicyEngine,
  defaultPiiMaskPolicies,
  CostOptimizer,
  GovernanceGate,
  defaultAgentGovernance,
  FileTimelineStore,
  createHttpLlmProvider,
  type AgentContract,
  type AgentRuntimeConfig,
} from '@hazeljs/agent';
import { wireDemoHitlAutoApprove } from '@hazeljs/agent-gatekeeper';
import { DemoLLMProvider } from '../llm/demo-llm.provider';
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
import {
  attachAgentVm,
  formatAgentVmBoot,
  type MeridianAgentVmBundle,
} from '../agent-vm';
import { createMeridianDecisionRuntime } from '../decision/meridian-decision';
import { DecisionController } from '../api/decision.controller';

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

function attachAgentVmIfEnabled(runtime: AgentRuntime): MeridianAgentVmBundle | undefined {
  return attachAgentVm(runtime);
}

export function createAgentOsRuntimeConfig(): AgentRuntimeConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const llm = apiKey
    ? createHttpLlmProvider({
        apiKey,
        model: process.env.AGENT_MODEL ?? 'gpt-4o-mini',
      })
    : new DemoLLMProvider();

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

  createMeridianDecisionRuntime({
    gatekeeper: gatekeeper.enabled ? gatekeeper.gatekeeper : undefined,
    checkpoints: durable.checkpointService,
    humanTasks: durable.humanTaskService,
  });

  if (process.env.JEST_WORKER_ID === undefined) {
    console.log(
      `Durable backend: ${meridianDurableBackend()}${flowEngine ? ' · Flow HITL peer: on' : ''}`
    );
    console.log(formatGatekeeperBoot(gatekeeper));
    console.log('Decision Runtime: refund-approval (POST /api/decision/refund)');
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
  wireDemoHitlAutoApprove(runtime);
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
  const vmBundle = attachAgentVmIfEnabled(runtime);
  wireDemoHitl(runtime);
  if (process.env.JEST_WORKER_ID === undefined) {
    const { report } = wireSkillgate(runtime, buildGateFromModule());
    console.log(formatReport(report));
    if (vmBundle) console.log(formatAgentVmBoot(vmBundle));
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
  const vmBundle = attachAgentVmIfEnabled(runtime);
  wireDemoHitl(runtime);
  const { report } = wireSkillgate(runtime, buildGateFromModule());
  console.log(formatReport(report));
  if (vmBundle) console.log(formatAgentVmBoot(vmBundle));
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
    const vmBundle = attachAgentVmIfEnabled(runtime);
    wireDemoHitl(runtime);
    const { report } = wireSkillgate(runtime, buildGateFromModule());
    console.log(formatReport(report));
    if (vmBundle) console.log(formatAgentVmBoot(vmBundle));
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
  controllers: [DecisionController],
  exports: [AgentModule],
})
export class AgentsModule {}
