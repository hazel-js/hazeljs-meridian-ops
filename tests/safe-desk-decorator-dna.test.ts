/**
 * safe-desk teaches the decorator DNA path: @Agent({ dna: true }) → dna/safe-desk.dna.json
 */

import * as path from 'path';
import { AgentRuntime, getAgentMetadata } from '@hazeljs/agent';
import { SafeDeskAgent } from '../src/agents/safe.agent';

const projectRoot = path.resolve(__dirname, '..');

describe('safe-desk decorator DNA', () => {
  it('declares dna: true on the agent class', () => {
    const meta = getAgentMetadata(SafeDeskAgent);
    expect(meta?.name).toBe('safe-desk');
    expect(meta?.dna).toBe(true);
  });

  it('loads dna/safe-desk.dna.json on registerAgentInstance', () => {
    const runtime = new AgentRuntime({
      projectRoot,
      enableRetry: false,
      enableCircuitBreaker: false,
      enableMetrics: false,
    });
    runtime.registerAgent(SafeDeskAgent);
    runtime.registerAgentInstance('safe-desk', new SafeDeskAgent());

    const dna = runtime.getAgentDna('safe-desk');
    expect(dna).toBeDefined();
    expect(dna!.name).toBe('safe-desk');
    expect(dna!.systemPrompt).toContain('specialist will follow up');

    const meta = runtime.getAgentMetadata('safe-desk');
    expect(meta?.systemPrompt).toBe(dna!.systemPrompt);
    expect(meta?.metadata?.dnaVersion).toBe(dna!.version);
  });
});
