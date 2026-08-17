/**
 * WHY: ADR-003 — inject FlowEngine so durable HITL mirrors WAITING/COMPLETED (refund saga peer).
 * Opt-in: AGENT_OS_FLOW_PEER=1. AgentRun remains source of truth for refund tools.
 */

export function createOptionalFlowPeer(): unknown | undefined {
  if (process.env.AGENT_OS_FLOW_PEER !== '1') return undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FlowEngine } = require('@hazeljs/flow') as {
    FlowEngine: new () => unknown;
  };
  return new FlowEngine();
}
