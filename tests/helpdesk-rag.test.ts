import { helpdeskRag } from '../src/rag/helpdesk-kb';

describe('helpdesk RAG KB', () => {
  it('ranks refund SLA for refund queries', async () => {
    const docs = await helpdeskRag.search('What is the refund SLA?', { topK: 2 });
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0].id).toBe('refund-sla');
    expect(docs[0].content.toLowerCase()).toContain('3–5');
  });

  it('is always available', async () => {
    await expect(helpdeskRag.isAvailable()).resolves.toBe(true);
  });
});
