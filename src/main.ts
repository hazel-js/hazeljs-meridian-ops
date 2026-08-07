/**
 * Meridian Ops Platform — Agent OS flagship
 *
 * Ship AI workers as part of your backend — versioned like packages,
 * governed like APIs, declared like infrastructure.
 */

import 'reflect-metadata';
import { HazelApp } from '@hazeljs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = new HazelApp(AppModule);
  app.enableCors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] });

  const port = parseInt(process.env.PORT ?? '3060', 10);
  await app.listen(port);

  const llm = process.env.OPENAI_API_KEY ? 'OpenAI' : 'DemoLLM (no API key)';

  console.log(`
┌────────────────────────────────────────────────────────────────────┐
│     Meridian Ops Platform — HazelJS Agent OS Flagship              │
├────────────────────────────────────────────────────────────────────┤
│  http://localhost:${String(port).padEnd(47)}│
│  LLM: ${llm.padEnd(52)}│
│                                                                    │
│  POST /api/chat              ops-router (default door)             │
│  POST /api/support/chat      support-desk + contract               │
│  POST /api/ops/chat          api-concierge (Skillgate)             │
│  POST /api/fraud/chat        fraud-triage (HITL freeze)            │
│  GET  /api/skillgate/report  include / deny skills                 │
│  GET  /__hazel               Inspector                             │
│                                                                    │
│  npm run store:sync | platform:sync | tour                         │
└────────────────────────────────────────────────────────────────────┘
`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
