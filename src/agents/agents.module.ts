/**
 * WHY: One AgentRuntime for all Meridian specialists + Skillgate + DNA overlay.
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
  createDurableRunStore,
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
import { applyDnaOverlays, formatOverlayReport } from '../platform/dna-overlay';
import { wireSkillgate, formatReport } from '../skillgate/wire-skills';
import { buildGateFromModule } from '../skillgate/build-gate';

export const supportContract: AgentContract = {
  name: 'support-desk-slo',
  maxLatencyMs: 120_000,
  fallbackAgent: 'safe-desk',
};

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
  const durableDir =
    process.env.AGENT_OS_DURABLE_DIR ?? path.join(process.cwd(), '.hazel', 'runs');
  const durable = createDurableRunStore(durableDir);

  return {
    llmProvider: llm,
    defaultMaxSteps: 8,
    defaultTimeout: 120_000,
    enableMetrics: true,
    enableRetry: true,
    enableCircuitBreaker: false,
    policyEngine,
    governanceGate: new GovernanceGate(defaultAgentGovernance()),
    costOptimizer: new CostOptimizer(),
    timelineStore: new FileTimelineStore(timelineFile),
    durableSuspend: true,
    runRepository: durable.runRepository,
    checkpointService: durable.checkpointService,
    humanTaskService: durable.humanTaskService,
  };
}

/** Auto-approve unless AGENT_OS_HITL=1 or SKILLGATE_HITL=1. */
export function wireDemoHitl(runtime: AgentRuntime): void {
  if (process.env.AGENT_OS_HITL === '1' || process.env.SKILLGATE_HITL === '1') return;
  runtime.on(AgentEventType.TOOL_APPROVAL_REQUESTED, (event) => {
    const data = (event as AgentEvent<{ requestId?: string }>).data;
    if (!data?.requestId) return;
    try {
      runtime.approveToolExecution(data.requestId, 'demo-auto-approver');
    } catch {
      /* durable path may not have an in-process waiter */
    }
    void runtime
      .approveAndResume(data.requestId, {
        approved: true,
        approvedBy: 'demo-auto-approver',
      })
      .catch(() => {
        /* no durable run yet — in-process approve is enough */
      });
  });
}

function registerAllAgents(runtime: AgentRuntime): void {
  runtime.registerAgent(SupportDeskAgent);
  runtime.registerAgent(SafeDeskAgent);
  runtime.registerAgent(FraudTriageAgent);
  runtime.registerAgent(OpsRouterAgent);
  runtime.registerAgent(ApiConciergeAgent);
  runtime.registerAgentInstance('support-desk', new SupportDeskAgent());
  runtime.registerAgentInstance('safe-desk', new SafeDeskAgent());
  runtime.registerAgentInstance('fraud-triage', new FraudTriageAgent());
  runtime.registerAgentInstance('ops-router', new OpsRouterAgent());
  runtime.registerAgentInstance('api-concierge', new ApiConciergeAgent());
}

export function createStandaloneAgentOs(): AgentRuntime {
  const runtime = new AgentRuntime(createAgentOsRuntimeConfig());
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
    MeridianBootstrap,
  ],
  exports: [AgentModule],
})
export class AgentsModule {}
