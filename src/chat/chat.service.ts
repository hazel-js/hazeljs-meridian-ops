/**
 * WHY: Chat is product behavior (real tools). hazel agent run is DNA smoke with stubs.
 */

import { Service } from '@hazeljs/core';
import {
  AgentService,
  runDigitalTwin,
  type AgentExecutionResult,
  type AgentRuntime,
} from '@hazeljs/agent';
import { supportContract } from '../agents/agents.module';

export interface ChatRequest {
  message: string;
  sessionId?: string;
  userId?: string;
  /** Default ops-router. Override: support-desk | fraud-triage | api-concierge | safe-desk */
  agent?: string;
  loop?: boolean;
  contract?: boolean;
  canary?: boolean;
}

export type AgentHost = {
  execute: AgentService['execute'];
  getTimeline: AgentService['getTimeline'];
  approveToolExecution: AgentService['approveToolExecution'];
  rejectToolExecution: AgentService['rejectToolExecution'];
  getRuntime: () => AgentRuntime;
};

function hostFromRuntime(runtime: AgentRuntime): AgentHost {
  return {
    execute: (name, input, options) => runtime.execute(name, input, options),
    getTimeline: (filter) => runtime.getTimeline(filter ?? {}),
    approveToolExecution: (id, by) => runtime.approveToolExecution(id, by),
    rejectToolExecution: (id) => runtime.rejectToolExecution(id),
    getRuntime: () => runtime,
  };
}

@Service()
export class ChatService {
  private readonly host: AgentHost;

  constructor(agents: AgentService) {
    this.host = agents;
  }

  static fromRuntime(runtime: AgentRuntime): ChatService {
    const svc = Object.create(ChatService.prototype) as ChatService;
    (svc as unknown as { host: AgentHost }).host = hostFromRuntime(runtime);
    return svc;
  }

  async chat(req: ChatRequest): Promise<{
    result: AgentExecutionResult;
    twin?: Awaited<ReturnType<typeof runDigitalTwin>>['compare'];
    agentOs: Record<string, unknown>;
    agent: string;
  }> {
    const agent = req.agent ?? 'ops-router';
    const successScore = Number(process.env.AGENT_OS_SUCCESS_SCORE ?? 80);
    const maxIterations = Number(process.env.AGENT_OS_MAX_LOOP ?? 4);
    const useContract = agent === 'support-desk' && req.contract !== false;

    const executePrimary = () =>
      this.host.execute(agent, req.message, {
        sessionId: req.sessionId ?? `session-${Date.now()}`,
        userId: req.userId ?? 'demo-user',
        loop:
          req.loop === false
            ? undefined
            : { maxIterations, successScore, stages: ['plan', 'execute', 'critique', 'validate'] },
        contract: useContract ? supportContract : undefined,
        recovery: useContract
          ? {
              maxRetries: 2,
              fallbackAgent: 'safe-desk',
              steps: ['retry', 'fallback_agent', 'fail'],
            }
          : undefined,
        metadata: { showcase: 'meridian-ops', agent },
      });

    if (req.canary && agent === 'support-desk') {
      const { primary, compare } = await runDigitalTwin({
        runPrimary: executePrimary,
        runTwin: () =>
          this.host.execute('safe-desk', req.message, {
            sessionId: req.sessionId,
            userId: req.userId,
          }),
        matchThreshold: 0.4,
        swallowTwinErrors: true,
      });
      return { result: primary, twin: compare, agentOs: this.snapshot(primary), agent };
    }

    const result = await executePrimary();
    return { result, agentOs: this.snapshot(result), agent };
  }

  async approve(requestId: string, approvedBy = 'meridian-ops') {
    const runtime = this.host.getRuntime();
    try {
      this.host.approveToolExecution(requestId, approvedBy);
    } catch {
      /* no in-process waiter */
    }
    return runtime.approveAndResume(requestId, { approved: true, approvedBy });
  }

  async reject(requestId: string, rejectedBy = 'meridian-ops') {
    const runtime = this.host.getRuntime();
    try {
      this.host.rejectToolExecution(requestId);
    } catch {
      /* */
    }
    return runtime.approveAndResume(requestId, { approved: false, approvedBy: rejectedBy });
  }

  timeline(agentName?: string) {
    return this.host.getTimeline(agentName ? { agentName } : {});
  }

  private snapshot(result: AgentExecutionResult) {
    return {
      loop: result.loop,
      contract: result.metadata?.contract,
      state: result.state,
      durationMs: result.duration,
      timelineSteps: this.host.getTimeline({ executionId: result.executionId }).length,
    };
  }
}
