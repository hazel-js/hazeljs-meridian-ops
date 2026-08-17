/**
 * ToolExecutor hook: evaluate + execute through Gatekeeper.
 *
 * AgentRuntime resume uses skipApproval, which the gate path ignores — so we
 * look up an already-approved HumanTask / provider record and pass approvalToken.
 */

import {
  fromHazelTool,
  GatekeeperApprovalRequiredError,
  invocationFingerprint,
  type AgentGatekeeper,
  type ToolExecutorGateInput,
  type ToolExecutorGateResult,
} from '@hazeljs/agent-gatekeeper';
import { meridianEnvironment, meridianTenantId } from '../config';

export interface HumanTaskLookup {
  listByRun(runId: string): Promise<
    Array<{
      id: string;
      status?: string;
      toolName?: string;
      payload?: unknown;
    }>
  >;
}

function shortToolName(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1) : name;
}

async function findApprovedToken(
  humanTasks: HumanTaskLookup | undefined,
  input: {
    runId: string;
    agentId: string;
    toolName: string;
    args: Record<string, unknown>;
    tenantId?: string;
  }
): Promise<string | undefined> {
  const toolName = shortToolName(input.toolName);
  const fingerprint = invocationFingerprint({
    agentId: input.agentId,
    toolName,
    input: input.args,
    tenantId: input.tenantId,
  });

  if (humanTasks) {
    const tasks = await humanTasks.listByRun(input.runId);
    for (const task of tasks) {
      const payload =
        task.payload && typeof task.payload === 'object'
          ? (task.payload as Record<string, unknown>)
          : {};
      const raw = payload.gatekeeperRequest;
      if (!raw || typeof raw !== 'object') continue;
      const gk = raw as {
        approvalId?: string;
        toolName?: string;
        invocationFingerprint?: string;
        status?: string;
      };
      const approvalId = gk.approvalId ?? task.id;
      const gkTool = gk.toolName ? shortToolName(gk.toolName) : shortToolName(task.toolName ?? '');
      if (gkTool !== toolName) continue;
      if (gk.invocationFingerprint && gk.invocationFingerprint !== fingerprint) continue;
      if (task.status === 'approved' || gk.status === 'approved') {
        return approvalId;
      }
    }
  }

  return undefined;
}

function resolveLiveMethod(tool: ToolExecutorGateInput['tool']): (...args: unknown[]) => unknown {
  const withKey = tool as ToolExecutorGateInput['tool'] & { propertyKey?: string };
  const key = withKey.propertyKey;
  const target = tool.target as Record<string, unknown> | undefined;
  if (key && target && typeof target[key] === 'function') {
    return target[key] as (...args: unknown[]) => unknown;
  }
  return tool.method as (...args: unknown[]) => unknown;
}

export function createMeridianAuthorizationGate(
  gatekeeper: AgentGatekeeper,
  deps: {
    humanTasks?: HumanTaskLookup;
  }
): { execute(input: ToolExecutorGateInput): Promise<ToolExecutorGateResult> } {
  return {
    async execute(input) {
      const start = Date.now();
      const toolName = shortToolName(input.tool.name);
      const runId = input.runId ?? `run-${input.sessionId}`;
      const tenantId = input.tenantId ?? meridianTenantId();
      const approvalToken = await findApprovedToken(deps.humanTasks, {
        runId,
        agentId: input.agentId,
        toolName,
        args: input.input,
        tenantId,
      });

      const context = {
        invocationId: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        runId,
        agentId: input.agentId,
        agentVersion: input.agentVersion,
        tenantId,
        delegatedUserId: input.userId,
        sessionId: input.sessionId,
        toolName,
        input: input.input,
        environment: input.environment ?? meridianEnvironment(),
        timestamp: new Date(),
        capabilities: input.capabilities,
        approvalToken,
      };

      const liveMethod = resolveLiveMethod(input.tool);
      const tool = fromHazelTool({ ...input.tool, method: liveMethod });

      try {
        const result = await gatekeeper.execute({ context, tool });
        return {
          success: true,
          output: result.output,
          duration: Date.now() - start,
        };
      } catch (err) {
        if (err instanceof GatekeeperApprovalRequiredError) {
          return {
            success: false,
            pendingApproval: true,
            requestId: err.approvalRequestId,
            duration: Date.now() - start,
            metadata: {
              toolName: input.tool.name,
              input: input.input,
              runId,
            },
          };
        }
        return {
          success: false,
          error: err instanceof Error ? err : new Error(String(err)),
          duration: Date.now() - start,
        };
      }
    },
  };
}
