/**
 * Offline RAG lab: query-dependent retrieval over a Meridian-style helpdesk KB.
 * Mirrors src/rag/helpdesk-kb.ts — no vector DB / API keys.
 *
 * From hazeljs-meridian-ops:
 *   npm run example:rag
 *
 * Blog: “Help center / FAQ over a large handbook → RAG”
 */
interface HelpdeskDoc {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  score?: number;
}

const KB: HelpdeskDoc[] = [
  {
    id: 'refund-sla',
    content:
      'Meridian Commerce refund SLA: approved refunds post to the original payment method in 3–5 business days. Never invent a refund ID — use processRefund via support-desk for money movement.',
    metadata: { topic: 'refunds', updatedAt: '2026-08-01' },
  },
  {
    id: 'tracking',
    content:
      'Tracking updates every 24 hours after the first carrier scan. If status is “preparing”, tell the customer to wait 24h before escalating.',
    metadata: { topic: 'shipping', updatedAt: '2026-08-01' },
  },
  {
    id: 'returns-window',
    content:
      'Returns are accepted within 30 days of delivery for unused items in original packaging. Damaged-in-transit claims need a photo and the order id.',
    metadata: { topic: 'returns', updatedAt: '2026-08-01' },
  },
  {
    id: 'api-keys-staging',
    content:
      'Rotate staging API keys from Settings → Developers → API keys. Revoke the old key only after the new key is deployed. Production keys require a second approver.',
    metadata: { topic: 'developers', updatedAt: '2026-09-12' },
  },
  {
    id: 'support-hours',
    content:
      'Live support hours are Mon–Fri 09:00–18:00 local warehouse time. After hours, the agent may look up orders but must not promise same-day callbacks.',
    metadata: { topic: 'ops', updatedAt: '2026-08-01' },
  },
];

function scoreDoc(query: string, doc: HelpdeskDoc): number {
  const q = query.toLowerCase();
  const hay = `${doc.id} ${doc.content}`.toLowerCase();
  let score = 0;
  for (const token of q.split(/[^a-z0-9]+/).filter((t) => t.length > 2)) {
    if (hay.includes(token)) score += 1;
  }
  if (q.includes('refund') && doc.id.includes('refund')) score += 2;
  if ((q.includes('track') || q.includes('ship')) && doc.id.includes('track')) score += 2;
  if (q.includes('return') && doc.id.includes('return')) score += 2;
  if ((q.includes('api') || q.includes('key') || q.includes('rotate')) && doc.id.includes('api'))
    score += 3;
  return score;
}

async function search(query: string, topK = 3): Promise<HelpdeskDoc[]> {
  return KB.map((doc) => ({ ...doc, score: scoreDoc(query, doc) }))
    .filter((d) => (d.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, topK);
}

function stubLlm(question: string, docs: HelpdeskDoc[]): string {
  if (!docs.length) return 'I could not find a matching handbook page.';
  const top = docs[0]!;
  return `Based on handbook [${top.id}]:\n${top.content}\n(Q: ${question})`;
}

async function main(): Promise<void> {
  const questions = [
    'What is the refund SLA?',
    'How do I rotate API keys on staging?',
    'When do tracking updates appear?',
  ];

  const runs = [];
  for (const question of questions) {
    const docs = await search(question, 2);
    runs.push({
      question,
      retrieved: docs.map((d) => ({ id: d.id, score: d.score, topic: d.metadata?.topic })),
      answer: stubLlm(question, docs),
    });
  }

  console.log(
    JSON.stringify(
      {
        lab: 'rag-helpdesk-agent',
        note: 'Same question shape as Meridian POST /api/helpdesk/chat — query picks different docs each time.',
        whyNotCag: 'Preloading all handbook pages into every prompt would waste tokens.',
        whyNotKag: 'These are procedure paragraphs, not a causal entity graph.',
        corpusSize: KB.length,
        runs,
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
