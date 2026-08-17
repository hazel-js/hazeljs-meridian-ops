/**
 * Wrap a Skillgate/MCP tool registry so tools/call goes through Gatekeeper.
 * Default MCP invoke bypasses AgentRuntime ToolExecutor.
 */

import { protectMcpInvoke, type AgentGatekeeper } from '@hazeljs/agent-gatekeeper';
import { meridianEnvironment, meridianTenantId } from '../config';

export interface McpRegistryLike {
  getAllTools(): Array<{
    name: string;
    target: object;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    method: Function;
  }>;
}

export function protectMcpRegistry(registry: McpRegistryLike, gatekeeper: AgentGatekeeper): void {
  const originals = new Map<
    string,
    { target: object; method: (...args: unknown[]) => unknown }
  >();

  for (const tool of registry.getAllTools()) {
    originals.set(tool.name, {
      target: tool.target,
      method: tool.method as (...args: unknown[]) => unknown,
    });
  }

  const invoke = protectMcpInvoke(
    async (toolName, input) => {
      const orig = originals.get(toolName);
      if (!orig) throw new Error(`Tool not found: ${toolName}`);
      return orig.method.call(orig.target, input);
    },
    gatekeeper,
    (toolName, input) => ({
      invocationId: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      runId: `mcp-${toolName}`,
      agentId: 'api-concierge',
      tenantId: meridianTenantId(),
      toolName,
      input,
      environment: meridianEnvironment(),
      timestamp: new Date(),
    })
  );

  for (const tool of registry.getAllTools()) {
    tool.method = (input: Record<string, unknown>) => invoke(tool.name, input);
  }
}
