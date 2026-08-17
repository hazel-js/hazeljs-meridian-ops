/**
 * WHY: Knowledge-grounded helpdesk without a vector DB — teach enableRAG + DNA, not Qdrant.
 * Adapter matches AgentContextBuilder.buildWithRAG (search(query, { topK }) → docs[]).
 */

export interface HelpdeskDoc {
  id: string;
  content: string;
  text?: string;
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
  return score;
}

/**
 * Runtime RAG adapter: returns a document array (not RAGSearchResponse).
 * Also exposes isAvailable for health checks.
 */
export const helpdeskRag = {
  async search(query: string, opts?: { topK?: number }): Promise<HelpdeskDoc[]> {
    const topK = opts?.topK ?? 3;
    const ranked = KB.map((doc) => ({ ...doc, score: scoreDoc(String(query), doc) }))
      .filter((d) => d.score > 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    if (ranked.length) return ranked.slice(0, topK);
    // Soft fallback: return SLA + tracking so DemoLLM always has grounding material.
    return KB.filter((d) => d.id === 'refund-sla' || d.id === 'tracking').slice(0, topK);
  },

  async isAvailable(): Promise<boolean> {
    return true;
  },

  /** Test helper — full corpus. */
  listDocuments(): HelpdeskDoc[] {
    return [...KB];
  },
};
