/**
 * Offline CAG lab: always-on merchant policy with cache hits + tenant isolation.
 *
 * From hazeljs-meridian-ops:
 *   npm run example:cag
 *
 * Blog: “Multi-merchant support: always-on return policy → CAG”
 */
import { CagService, MemoryCagStore } from '@hazeljs/cag';

const POLICIES: Record<string, string> = {
  'merchant-123':
    'Demo Restaurant return policy: Customers may return unused goods within 30 days with receipt. ' +
    'Opened food items are non-refundable. Refunds are issued to the original payment method within 5–7 business days.',
  'merchant-other':
    'Other Cafe return policy: Store credit only within 14 days. No cash refunds.',
};

async function main(): Promise<void> {
  const cag = new CagService(
    {
      multiTenant: true,
      ttl: '6h',
      maxTokens: 8_000,
      tokenBudget: { max: 8_000, strategy: 'priority' },
      compression: true,
    },
    new MemoryCagStore()
  );

  let policyVersion = '2026-10';

  cag.register(
    {
      id: 'return-policy',
      priority: 100,
      compressible: false,
      version: policyVersion,
      source: {
        type: 'function',
        load: async (input) => {
          const body = POLICIES[input.tenantId] ?? 'Default return policy: contact support.';
          return `${body} (policy version ${policyVersion})`;
        },
      },
    },
    'support'
  );

  cag.register(
    {
      id: 'hours',
      priority: 40,
      source: {
        type: 'text',
        content: 'Support hours: Mon–Fri 09:00–17:00 CET.',
      },
    },
    'support'
  );

  const question = 'What is your return policy?';
  const tenantA = 'merchant-123';
  const tenantB = 'merchant-other';

  const first = await cag.getContext({ namespace: 'support', tenantId: tenantA });
  const second = await cag.getContext({ namespace: 'support', tenantId: tenantA });
  const otherTenant = await cag.getContext({ namespace: 'support', tenantId: tenantB });

  // Version bump → re-register so fingerprint changes and tenant A misses.
  policyVersion = '2026-11';
  cag.register(
    {
      id: 'return-policy',
      priority: 100,
      compressible: false,
      version: policyVersion,
      source: {
        type: 'function',
        load: async (input) => {
          const body = POLICIES[input.tenantId] ?? 'Default return policy: contact support.';
          return `${body} (policy version ${policyVersion})`;
        },
      },
    },
    'support'
  );
  const afterVersionBump = await cag.getContext({ namespace: 'support', tenantId: tenantA });

  const answer = stubLlm(question, first.context.text);

  console.log(
    JSON.stringify(
      {
        lab: 'cag-support-agent',
        question,
        whyNotRag: 'Same policy every turn — retrieval would burn embed+search for static text.',
        whyNotKag: 'Static prose, not multi-hop entity reasoning.',
        tenantA: {
          id: tenantA,
          firstHit: first.hit,
          secondHit: second.hit,
          afterVersionBumpHit: afterVersionBump.hit,
          tokens: first.context.tokenCount,
          coldVersion: first.context.text.includes('2026-10'),
          warmAfterBumpVersion: afterVersionBump.context.text.includes('2026-11'),
          policyPreview: first.context.text.slice(0, 140),
        },
        tenantB: {
          id: tenantB,
          hit: otherTenant.hit,
          isolated: !otherTenant.context.text.includes('Demo Restaurant'),
          policyPreview: otherTenant.context.text.slice(0, 140),
        },
        metrics: cag.getMetrics(),
        answer,
      },
      null,
      2
    )
  );
}

function stubLlm(question: string, context: string): string {
  return `Based on cached merchant policy:\n${context.split('.')[0]}.\n(Q: ${question})`;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
