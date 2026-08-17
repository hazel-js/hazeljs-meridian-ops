import { describeAgent, runAgentSuite, assertAgentResult, expectTools } from '@hazeljs/testing';
import { createStandaloneAgentOs } from '../src/agents/agents.module';

describe('Meridian support + scenarios', () => {
  const runtime = createStandaloneAgentOs();

  const suite = describeAgent(
    'Support Desk',
    ({ test }) => {
      test('tracks a shipped order', async ({ run }) => {
        const result = await run('Where is my package for ORD-1001?');
        expectTools(result, ['trackShipment'], 0.5);
        assertAgentResult(result, { maxLatencyMs: 15_000 });
        expect(result.output.length).toBeGreaterThan(10);
      });
    },
    { maxLatencyMs: 20_000, failFast: false }
  );

  it('passes describeAgent regression', async () => {
    const { failed, errors } = await runAgentSuite(suite, {
      agentName: 'support-desk',
      run: async (input) => {
        const out = await runtime.execute('support-desk', input, {
          loop: { maxIterations: 2, successScore: 90 },
          sessionId: `test-${Date.now()}`,
        });
        return {
          output: out.response ?? '',
          durationMs: out.duration,
          toolCalls: out.steps
            .filter((s) => s.action?.toolName)
            .map((s) => s.action!.toolName!.replace(/^.*\./, '')),
          executionId: out.executionId,
        };
      },
    });
    expect(errors).toEqual([]);
    expect(failed).toBe(0);
  }, 60_000);

  it('fraud triage can fetch risk signals', async () => {
    const out = await runtime.execute('fraud-triage', 'What is the risk for ACC-RISK?', {
      sessionId: `fraud-${Date.now()}`,
    });
    expect(['completed', 'waiting_for_approval', 'waiting_for_input', 'failed']).toContain(
      out.state
    );
    const tools = out.steps.map((s) => s.action?.toolName).filter(Boolean);
    expect(tools.some((t) => String(t).includes('getRiskSignals'))).toBe(true);
  }, 30_000);
});
