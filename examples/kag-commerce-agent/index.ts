/**
 * Offline KAG lab: settlement shortfall explained via graph evidence + contradiction.
 *
 * From hazeljs-meridian-ops:
 *   npm run example:kag
 *
 * Blog: “Ops / finance: why was settlement short? → KAG”
 */
import {
  KnowledgeGraph,
  COMMERCE_INDUSTRY_PROFILE,
  GENERIC_INDUSTRY_PROFILE,
} from '@hazeljs/kag';

async function main(): Promise<void> {
  // Commerce relation vocabulary is opt-in via industry profile — not the KAG default.
  const kag = new KnowledgeGraph({
    tenantId: 'merchant-123',
    graph: 'commerce',
    industry: [GENERIC_INDUSTRY_PROFILE, COMMERCE_INDUSTRY_PROFILE],
    llm: async (prompt: string) => {
      const match = /Evidence:\n([\s\S]*?)\nConfidence:/.exec(prompt);
      return match
        ? `Yesterday's settlement was €1,420 lower because of refunds affecting settlement.\n${match[1].slice(0, 400)}`
        : 'Insufficient evidence.';
    },
  });

  await kag.entity({
    id: 'merchant-123',
    type: 'merchant',
    properties: { name: 'Demo Restaurant' },
  });
  await kag.entity({ id: 'order-1', type: 'order', properties: { total: 5000 } });
  await kag.entity({ id: 'payment-1', type: 'payment', properties: { amount: 5000 } });
  await kag.entity({ id: 'refund-1', type: 'refund', properties: { amount: 1420 } });
  await kag.entity({ id: 'fee-1', type: 'fee', properties: { amount: 20 } });
  await kag.entity({
    id: 'settlement-1',
    type: 'settlement',
    properties: { amount: 3560, expected: 4980 },
  });

  await kag.relate({ from: 'merchant-123', to: 'order-1', type: 'HAS_ORDER' });
  await kag.relate({ from: 'order-1', to: 'payment-1', type: 'HAS_PAYMENT' });
  await kag.relate({
    from: 'payment-1',
    to: 'refund-1',
    type: 'HAS_REFUND',
    source: { type: 'database', id: 'refund-456', authority: 90 },
  });
  await kag.relate({ from: 'refund-1', to: 'settlement-1', type: 'AFFECTS' });
  await kag.relate({ from: 'fee-1', to: 'settlement-1', type: 'AFFECTS' });

  await kag.fact({
    subject: 'refund-1',
    predicate: 'amount',
    object: 1420,
    confidence: 0.98,
    source: { type: 'database', id: 'refund-456', authority: 90 },
  });
  await kag.fact({
    subject: 'settlement-1',
    predicate: 'delta',
    object: -1420,
    confidence: 0.95,
    source: { type: 'ledger', id: 'settle-1', authority: 90 },
  });

  // Conflicting low-authority rumor — KAG should retain it, not silently overwrite.
  await kag.fact({
    subject: 'settlement-1',
    predicate: 'delta',
    object: -200,
    confidence: 0.4,
    source: { type: 'manual', id: 'ops-chat-rumor', authority: 20 },
  });

  const question =
    "Why is yesterday's settlement €1,420 lower than expected for Demo Restaurant?";
  const result = await kag.ask(question, { explain: true });

  console.log(
    JSON.stringify(
      {
        lab: 'kag-commerce-agent',
        question,
        whyNotRag:
          'Passages might mention refunds but will not reconstruct merchant→order→payment→refund→settlement with sources.',
        whyNotCag: 'Ledger state changes daily — a cached narrative goes stale immediately.',
        answer: result.answer,
        confidence: result.confidence,
        evidence: result.evidence,
        sources: result.sources,
        explanation: result.explanation,
        contradictionNote:
          'A low-authority rumor (delta=-200) was retained beside the ledger fact (not silently overwritten). Both appear in explanation/sources; overall confidence drops until ops resolves the conflict.',
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
