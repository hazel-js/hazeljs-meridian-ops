/**
 * One-shot scenarios without HTTP (standalone runtime).
 */

import 'reflect-metadata';
import { createStandaloneAgentOsWithOverlay } from '../src/agents/agents.module';
import { ChatService } from '../src/chat/chat.service';

async function main() {
  process.env.AGENT_OS_HITL = process.env.AGENT_OS_HITL ?? '0';
  const runtime = await createStandaloneAgentOsWithOverlay();
  const chat = ChatService.fromRuntime(runtime);

  const scenarios: Array<{ name: string; agent: string; message: string }> = [
    { name: 'track', agent: 'support-desk', message: 'Where is my package for ORD-1001?' },
    { name: 'refund', agent: 'support-desk', message: 'I want a refund for ORD-1002' },
    { name: 'fraud', agent: 'fraud-triage', message: 'Check risk and freeze ACC-RISK' },
    { name: 'router', agent: 'ops-router', message: 'Track ORD-1001 please' },
    { name: 'ops', agent: 'api-concierge', message: 'List recent orders' },
  ];

  for (const s of scenarios) {
    console.log(`\n=== ${s.name} (${s.agent}) ===`);
    const out = await chat.chat({ message: s.message, agent: s.agent, loop: false });
    console.log({
      state: out.result.state,
      response: (out.result.response ?? '').slice(0, 200),
      tools: out.result.steps.map((st) => st.action?.toolName).filter(Boolean),
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
