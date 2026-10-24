/**
 * Offline @hazeljs/context lab — auto-plans CAG + RAG + KAG + Memory.
 *
 * From hazeljs-meridian-ops:
 *   npm run example:context
 *
 * Blog: “Hybrid desk: policy + ledger + handbook + preference → context”
 */
import { CagService, MemoryCagStore } from '@hazeljs/cag';
import { KnowledgeGraph, COMMERCE_INDUSTRY_PROFILE } from '@hazeljs/kag';
import { ContextService } from '@hazeljs/context';

const HANDBOOK = [
  {
    id: 'refund-sla',
    content:
      'Meridian Commerce refund SLA: approved refunds post to the original payment method in 3–5 business days.',
  },
  {
    id: 'settlement-faq',
    content:
      'Settlement shortfalls are usually refunds or fees. Ops should confirm the ledger delta before promising a top-up.',
  },
];

async function main(): Promise<void> {
  const cag = new CagService({ multiTenant: true, ttl: '1h' }, new MemoryCagStore());
  cag.register(
    {
      id: 'refund-policy',
      priority: 100,
      compressible: false,
      version: '2026-10',
      source: {
        type: 'text',
        content:
          'Refunds are issued within 5–7 business days to the original payment method. Policy version 2026-10.',
      },
    },
    'support'
  );

  const kag = new KnowledgeGraph({
    tenantId: 'merchant-123',
    industry: COMMERCE_INDUSTRY_PROFILE,
  });
  await kag.entity({
    id: 'merchant-123',
    type: 'merchant',
    properties: { name: 'Demo Restaurant' },
  });
  await kag.entity({ id: 'refund-1', type: 'refund', properties: { amount: 1420 } });
  await kag.relate({
    from: 'merchant-123',
    to: 'refund-1',
    type: 'HAS_REFUND',
    source: { type: 'database', id: 'refund-456' },
  });
  await kag.fact({
    subject: 'refund-1',
    predicate: 'amount',
    object: 1420,
    confidence: 0.98,
    source: { type: 'database', id: 'refund-456', authority: 90 },
  });

  const context = new ContextService({
    strategy: 'auto',
    sources: ['cache', 'rag', 'knowledge', 'memory'],
    cag,
    kag,
    rag: {
      async search(query: string) {
        const q = query.toLowerCase();
        return HANDBOOK.filter(
          (d) =>
            q.includes('refund') ||
            q.includes('settlement') ||
            d.content.toLowerCase().includes('settlement')
        ).map((d, i) => ({ id: d.id, content: d.content, score: 0.9 - i * 0.05 }));
      },
    },
    memory: {
      async query() {
        return [{ key: 'show_amounts', value: 'exclude VAT', category: 'preference' }];
      },
    },
  });

  const query =
    'Why was Demo Restaurant settlement impacted by a refund, given our refund policy and my VAT preference?';
  const assembled = await context.assemble({
    query,
    tenantId: 'merchant-123',
    namespace: 'support',
    userId: 'ops-1',
  });

  console.log(
    JSON.stringify(
      {
        lab: 'context-auto-agent',
        query,
        layerMap: {
          CAG: 'stable refund policy (versioned)',
          RAG: 'handbook settlement / refund SLA snippets',
          KAG: 'merchant → refund evidence path',
          Memory: 'exclude VAT preference for ops-1',
        },
        plan: assembled.plan,
        sourcesUsed: assembled.sourcesUsed,
        tokenEstimate: assembled.tokenEstimate,
        textPreview: assembled.text.slice(0, 900),
      },
      null,
      2
    )
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
