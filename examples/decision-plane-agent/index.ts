/**
 * Offline Decision Plane lab — finite answers, harness-neutral.
 * Does not replace DecisionRuntime (see POST /api/decision/refund).
 *
 * From hazeljs-meridian-ops:
 *   npm run example:decision-plane
 */
import {
  createDecisionPlane,
  createRulesPlaneProvider,
  defineDecision,
} from '@hazeljs/decision';

const route = defineDecision({
  id: 'meridian.model-route',
  version: '1',
  answers: ['fast', 'balanced', 'advanced', 'abstain'] as const,
  criteria: {
    fast: 'Routine factual question',
    balanced: 'Ambiguous intent / policy FAQ',
    advanced: 'Consequential refund or freeze',
    abstain: 'Insufficient evidence',
  },
  strategy: { providers: ['rules'], onFailure: 'abstain' },
});

const plane = createDecisionPlane({
  providers: [
    createRulesPlaneProvider({
      rules: [
        {
          answer: 'advanced',
          when: (c) => Boolean((c as { moneyMove?: boolean }).moneyMove),
          summary: 'Money move → advanced',
        },
        {
          answer: 'fast',
          when: (c) => Boolean((c as { routine?: boolean }).routine),
          summary: 'Routine → fast',
        },
        {
          answer: 'balanced',
          when: (c) => Boolean((c as { policyFaq?: boolean }).policyFaq),
          summary: 'Policy FAQ → balanced',
        },
      ],
      onNoMatch: 'abstain',
    }),
  ],
});

async function decide(label: string, context: Record<string, unknown>): Promise<void> {
  const result = await plane.decide({
    definition: route,
    context,
    execution: {
      tenantId: 'meridian',
      actorId: 'lab',
      permissionScope: 'support',
      policyVersion: 'lab-1',
    },
  });
  const answer = result.status === 'succeeded' ? result.answer : result.status;
  console.log(`\n[${label}]`);
  console.log(`  context: ${JSON.stringify(context)}`);
  console.log(`  result:  ${result.status}${result.status === 'succeeded' ? ` → ${answer}` : ''}`);
  if (result.status === 'succeeded') console.log(`  summary: ${result.summary}`);
  if (result.status === 'abstained') console.log(`  reason:  ${result.reason}`);
}

async function main(): Promise<void> {
  console.log('Meridian Decision Plane lab (rules provider — no API keys)');
  console.log('Plane ≠ DecisionRuntime: finite answers only; Gatekeeper still authorizes tools.');

  await decide('track order', { routine: true });
  await decide('refund SLA', { policyFaq: true });
  await decide('refund ORD-1001', { moneyMove: true });
  await decide('???', {});

  console.log('\nDone. Live API twin: POST /api/decision/plane/route after npm run dev.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
