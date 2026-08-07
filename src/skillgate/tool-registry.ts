/**
 * Bridge: AgentRuntime keeps ToolRegistry private today.
 * Skillgate.register() needs the same registry the executor uses.
 */
import type { AgentRuntime, ToolRegistry } from '@hazeljs/agent';

export function toolRegistryOf(runtime: AgentRuntime): ToolRegistry {
  return (runtime as unknown as { toolRegistry: ToolRegistry }).toolRegistry;
}
