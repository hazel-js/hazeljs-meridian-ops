/**
 * Wrap MCP tools/call through Gatekeeper (default MCP invoke skips ToolExecutor).
 */

import { protectMcpRegistry, type AgentGatekeeper } from '@hazeljs/agent-gatekeeper';
import { meridianEnvironment, meridianTenantId } from '../config';

export { type McpRegistryLike } from '@hazeljs/agent-gatekeeper';

export function protectMcpRegistryForMeridian(
  registry: Parameters<typeof protectMcpRegistry>[0],
  gatekeeper: AgentGatekeeper
): void {
  protectMcpRegistry(registry, gatekeeper, {
    agentId: 'api-concierge',
    tenantId: meridianTenantId(),
    environment: meridianEnvironment(),
  });
}

export { protectMcpRegistryForMeridian as protectMcpRegistry };
