# Context & governance labs

Offline TypeScript demos. No API keys unless noted.

| Lab | Script | Teaches |
|-----|--------|---------|
| [`rag-helpdesk-agent`](./rag-helpdesk-agent) | `npm run example:rag` | Query-dependent handbook retrieval |
| [`cag-support-agent`](./cag-support-agent) | `npm run example:cag` | Cached policy, tenant isolation, version invalidation |
| [`kag-commerce-agent`](./kag-commerce-agent) | `npm run example:kag` | Settlement evidence path + contradictions |
| [`context-auto-agent`](./context-auto-agent) | `npm run example:context` | Auto planner over CAG + RAG + KAG + Memory |
| [`decision-plane-agent`](./decision-plane-agent) | `npm run example:decision-plane` | Finite answers (`fast` / `balanced` / `advanced` / `abstain`) — not DecisionRuntime |
| [`governed-runtime-agent`](./governed-runtime-agent) | `npm run example:governed-runtime` | `createGovernedRuntime` HITL + ledger idempotency (no AgentRuntime) |
| [`governed-memory-agent`](./governed-memory-agent) | `npm run example:governed-memory` | capture → accept → retrieve → forget (tenant-scoped) |
| [`ai-call-contract-agent`](./ai-call-contract-agent) | `npm run example:ai-call-contract` | `@AgentTool`, GatekeeperApprovalPort suspend/resume, `runAiGolden` |

```bash
# from hazeljs-meridian-ops/ — build sibling packages once if using file: deps
cd ../hazeljs && npx tsc -b packages/ai packages/decision packages/agent-gatekeeper packages/memory packages/eval packages/context packages/cag packages/kag
cd ../hazeljs-meridian-ops
npm run example:install
npm run example:rag
npm run example:cag
npm run example:kag
npm run example:context
npm run example:decision-plane
npm run example:governed-runtime
npm run example:governed-memory
npm run example:ai-call-contract
```

Live twins after `npm run dev`:

- RAG helpdesk → `POST /api/helpdesk/chat`
- Decision Plane route → `POST /api/decision/plane/route`
- Decision Runtime refund → `POST /api/decision/refund`
