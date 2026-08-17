import { createOptionalFlowPeer } from '../src/flow/create-flow-peer';

describe('Flow HITL peer (Phase 6)', () => {
  const prev = process.env.AGENT_OS_FLOW_PEER;

  afterEach(() => {
    if (prev === undefined) delete process.env.AGENT_OS_FLOW_PEER;
    else process.env.AGENT_OS_FLOW_PEER = prev;
  });

  it('is off by default', () => {
    delete process.env.AGENT_OS_FLOW_PEER;
    expect(createOptionalFlowPeer()).toBeUndefined();
  });

  it('constructs FlowEngine when AGENT_OS_FLOW_PEER=1', () => {
    process.env.AGENT_OS_FLOW_PEER = '1';
    const engine = createOptionalFlowPeer() as {
      startRun?: unknown;
      tick?: unknown;
      resumeRun?: unknown;
    };
    expect(engine).toBeDefined();
    expect(typeof engine.startRun).toBe('function');
    expect(typeof engine.tick).toBe('function');
    expect(typeof engine.resumeRun).toBe('function');
  });
});
