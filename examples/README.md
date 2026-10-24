# Context labs (RAG / CAG / KAG / Context)

Offline TypeScript demos for the [RAG vs CAG vs KAG](https://hazeljs.ai/blog/rag-vs-cag-vs-kag) post. No API keys.

| Lab | Script | Teaches |
|-----|--------|---------|
| [`rag-helpdesk-agent`](./rag-helpdesk-agent) | `npm run example:rag` | Query-dependent handbook retrieval |
| [`cag-support-agent`](./cag-support-agent) | `npm run example:cag` | Cached policy, tenant isolation, version invalidation |
| [`kag-commerce-agent`](./kag-commerce-agent) | `npm run example:kag` | Settlement evidence path + contradictions |
| [`context-auto-agent`](./context-auto-agent) | `npm run example:context` | Auto planner over CAG + RAG + KAG + Memory |

No API keys. The RAG lab is pure TypeScript; the others use `@hazeljs/cag`, `@hazeljs/kag`, and `@hazeljs/context`.

```bash
# from hazeljs-meridian-ops/
npm run example:install
npm run example:rag
npm run example:cag
npm run example:kag
npm run example:context
```

Live Meridian RAG helpdesk (same KB idea): `POST /api/helpdesk/chat` after `npm run dev`.
