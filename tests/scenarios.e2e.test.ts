import 'reflect-metadata';
import { createStandaloneAgentOs } from '../src/agents/agents.module';
import { ChatService } from '../src/chat/chat.service';

describe('Meridian scenarios e2e (standalone)', () => {
  const runtime = createStandaloneAgentOs();
  const chat = ChatService.fromRuntime(runtime);

  it('support tracks ORD-1001', async () => {
    const out = await chat.chat({
      message: 'Where is my package for ORD-1001?',
      agent: 'support-desk',
    });
    expect(out.result.state).toBe('completed');
    expect(out.result.response?.length ?? 0).toBeGreaterThan(5);
  }, 30_000);

  it('router delegates tracking to support-desk', async () => {
    const out = await chat.chat({
      message: 'Track ORD-1001',
      agent: 'ops-router',
    });
    expect(out.result.state).toBe('completed');
    const tools = out.result.steps.map((s) => s.action?.toolName).join(' ');
    expect(tools).toMatch(/support-desk/);
    expect(out.result.response ?? '').toMatch(/ORD-1001|1Z999|shipped/i);
  }, 30_000);

  it('fraud loads risk for ACC-RISK', async () => {
    const out = await chat.chat({
      message: 'What is the risk score for ACC-RISK?',
      agent: 'fraud-triage',
    });
    const tools = out.result.steps.map((s) => s.action?.toolName).join(' ');
    expect(tools).toMatch(/getRiskSignals/);
  }, 30_000);
});
