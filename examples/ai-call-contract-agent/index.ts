/**
 * Offline @hazeljs/ai call-contract lab — FakeModel, @AgentTool, budgets, durable HITL, goldens.
 * No network / API keys.
 *
 * From hazeljs-meridian-ops:
 *   npm run example:ai-call-contract
 */
import { z } from 'zod';
import {
  AIEnhancedService,
  AIModule,
  AgentTool,
  FakeModel,
  GatekeeperApprovalPort,
  InMemoryCallCheckpointStore,
  runAiGolden,
} from '@hazeljs/ai';

class CommerceTools {
  @AgentTool({
    name: 'lookupOrder',
    description: 'Look up an order by id',
    inputSchema: z.object({ orderId: z.string() }),
  })
  async lookupOrder(input: { orderId: string }) {
    return { orderId: input.orderId, status: 'shipped', eta: '2026-11-08' };
  }

  @AgentTool({
    name: 'processRefund',
    description: 'Refund an order (requires approval)',
    inputSchema: z.object({ orderId: z.string(), amount: z.number() }),
  })
  async processRefund(input: { orderId: string; amount: number }) {
    return { refunded: input.orderId, amount: input.amount };
  }
}

async function demoDurableHitl(): Promise<void> {
  console.log('\n— Durable Gatekeeper HITL on the tool loop —');
  AIModule.register({
    models: { default: { provider: 'openai', model: 'gpt-4o-mini' } },
    defaults: { maxSteps: 4, budget: { maxTokens: 8_000 } },
  });

  let allowed = false;
  const port = new GatekeeperApprovalPort({
    async evaluate(req) {
      if (req.approvalToken === 'tok_ops' || allowed) return { status: 'allowed' };
      return { status: 'require_approval', approvalId: 'appr_lab_1' };
    },
  });

  const fake = new FakeModel([
    { toolCalls: [{ name: 'processRefund', input: { orderId: 'ORD-1001', amount: 50 } }] },
    'Refund completed for ORD-1001.',
  ]);
  const ai = new AIEnhancedService();
  ai.registerProvider(fake);
  ai.registerTools(new CommerceTools());
  ai.setApprovalPort(port);
  ai.setCheckpointStore(new InMemoryCallCheckpointStore());

  const suspended = await ai.complete(
    { messages: [{ role: 'user', content: 'Please refund ORD-1001 for $50' }] },
    { modelName: 'default', tools: ['processRefund'], approve: ['processRefund'] }
  );
  console.log(`Suspended: finishReason=${suspended.finishReason} approvalId=${suspended.approvalId}`);

  allowed = true;
  const resumed = await ai.resumeAfterApproval({
    checkpointId: suspended.checkpointId!,
    approvalId: suspended.approvalId!,
    approvalToken: 'tok_ops',
  });
  console.log(`Resumed: ${resumed.content}`);
}

async function demoGolden(): Promise<void> {
  console.log('\n— Eval-native golden (FakeModel expectedCalls) —');
  const result = await runAiGolden({
    dataset: {
      name: 'meridian-support',
      version: '1',
      cases: [
        {
          id: 'track',
          input: 'Where is ORD-1001?',
          expectedOutput: 'shipped',
          expectedToolCalls: ['lookupOrder'],
          metadata: {
            expectedCalls: [
              {
                toolNames: ['lookupOrder'],
                messageIncludes: 'ORD-1001',
              },
            ],
          },
        },
      ],
    },
    repliesForCase: () => [
      { toolCalls: [{ name: 'lookupOrder', input: { orderId: 'ORD-1001' } }] },
      'Order ORD-1001 is shipped.',
    ],
    caseRunner: async ({ input, fake }) => {
      AIModule.register({
        models: { default: { provider: 'openai', model: 'gpt-4o-mini' } },
        defaults: { maxSteps: 3 },
      });
      const ai = new AIEnhancedService();
      ai.registerProvider(fake);
      ai.registerTools(new CommerceTools());
      const res = await ai.complete(
        { messages: [{ role: 'user', content: input }] },
        { modelName: 'default', tools: ['lookupOrder'] }
      );
      return { output: res.content, toolCalls: ['lookupOrder'] };
    },
  });
  console.log(
    `Golden ${result.datasetName}@${result.datasetVersion}: passed=${result.passed} avg=${result.averageScore}`
  );
  for (const c of result.caseResults) {
    console.log(`  case ${c.caseId}: ${c.passed ? 'ok' : 'FAIL'} score=${c.score}`);
  }
}

async function main(): Promise<void> {
  console.log('Meridian AI call-contract lab (FakeModel — no API keys)');
  console.log('Shows named-model defaults, @AgentTool loop, GatekeeperApprovalPort, runAiGolden.');
  await demoDurableHitl();
  await demoGolden();
  console.log('\nDone. Full Agent OS durability remains on AgentRuntime + createGovernedRuntime.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
