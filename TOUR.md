# Meridian 15-minute tour

![Tour flow](./docs/assets/meridian-tour.svg)

## 1. Sync packages + platform (2 min)

```bash
npm install
npm run store:sync
npm run platform:sync
npm run tour
```

## 2. Start the app (1 min)

```bash
npm run dev
# open http://localhost:3060/__hazel
```

Boot log should show Skillgate report + `DNA overlay: …` + `Gatekeeper: enforce · deny · …` (+ `Agent VM: on` when enabled).

## 3. Track an order (F1–F2)

```bash
curl -s localhost:3060/api/support/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Where is my package for ORD-1001?"}' | jq .
```

## 4. Refund HITL off then on (F7–F8)

```bash
curl -s localhost:3060/api/gatekeeper/status | jq '{mode, defaultDecision, approvalBackend, policies: [.policies[].id]}'

# Auto-approve (default AGENT_OS_HITL=0)
curl -s localhost:3060/api/support/chat \
  -H 'content-type: application/json' \
  -d '{"message":"I want a refund for ORD-1002"}' | jq .

# Real HITL: set AGENT_OS_HITL=1, restart, then:
# curl … refund … → pendingApproval.requestId
# curl -s -X POST localhost:3060/api/approvals/<id>/approve | jq .
```

## 4b. Decision Runtime refund (closed-set → HITL → Gatekeeper)

```bash
curl -s localhost:3060/api/decision/status | jq .

# Always pauses for Decision HITL (human-required). Confidence ≠ permission.
DEC=$(curl -s localhost:3060/api/decision/refund \
  -H 'content-type: application/json' \
  -d '{"orderId":"ORD-1001","amount":50,"reason":"tour"}')
echo "$DEC" | jq '{decisionId, status, decision, confidence, next}'

# Override → Gatekeeper authorizes payments.refund (no double-invoke on repeat)
curl -s -X POST "localhost:3060/api/decision/refund/$(echo "$DEC" | jq -r .decisionId)/resume" \
  -H 'content-type: application/json' \
  -d "$(echo "$DEC" | jq -c '{runId, action:"override", decision:"approve", actor:"ops-lead", execute:true}')" | jq .
```

Lab UI for compare/flow/history is [hazeljs-agent-office](https://github.com/hazel-js/hazeljs-agent-office) `/office/decisions` — not Meridian Inspector.

## 5. Fraud freeze (F12 partial)

```bash
curl -s localhost:3060/api/fraud/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Freeze ACC-RISK — high fraud risk"}' | jq .
```

## 6. Router door (F12)

```bash
curl -s localhost:3060/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Track ORD-1001"}' | jq '{agent, steps, response}'
```

## 7. Skillgate report (F13)

```bash
curl -s 'localhost:3060/api/skillgate/report?json=1' | jq '{included: .included|length, denied: .denied|length}'
curl -s localhost:3060/api/ops/chat \
  -H 'content-type: application/json' \
  -d '{"message":"List recent orders"}' | jq .
```

## 8. Stub vs real (F6)

```bash
npm run demo:smoke-cli
```

## 9. Control-plane events (F19–F21)

```bash
# if hazel CLI built:
# hazel agent events --limit 20 --project .
cat .hazel/platform/events.jsonl | tail -5
```

## 10. Optional remote registry (F22 / Journey D)

Local tour never requires Cloud. To demo a hosted registry (slim `hazeljs-cloud-backend` or Team URL):

```bash
export HAZEL_REGISTRY_URL=http://127.0.0.1:3000
export HAZEL_REGISTRY_TOKEN=<api-key>   # from cloud seed:dev / org key
npm run store:sync:remote
```

Still materializes locally so Meridian boot does not depend on the remote.

---

## Phase 6 labs (optional — skip on first pass)

### F. Agent VM — speculation + undo

Build sibling packages from `../hazeljs` (agent + agent-vm use local `file:` deps):

```bash
cd ../hazeljs
npx tsc -b packages/agent packages/agent-vm
cd ../hazeljs-meridian-ops
npm install
export AGENT_OS_AGENT_VM=1
npm run dev
```

Status + travel speculation lab (no LLM — proves branch rollback):

```bash
curl -s localhost:3060/api/agent-vm/status | jq .
curl -s -X POST 'localhost:3060/api/agent-vm/speculate/travel?branches=3' | jq .
# activeHolds: 1, releasedHolds: 2, rolledBackBranches: 2
```

Support-desk tools are effect-typed when VM is on: reads are `@Read`, refunds are `@Reversible` with `@Compensate` → `commerceStore.reverseRefund`.

### A. Prisma / SQL durable runs

```bash
export DATABASE_URL=file:./.hazel/meridian.db
export AGENT_OS_DURABLE_BACKEND=sql
npm run db:push
# restart npm run dev — boot prints "Durable backend: sql"
# Repeat HITL refund; runs persist in SQLite instead of .hazel/runs/
```

### B. RAG helpdesk

```bash
curl -s localhost:3060/api/helpdesk/chat \
  -H 'content-type: application/json' \
  -d '{"message":"What is the refund SLA?"}' | jq '{agent, response, steps}'
```

### C. Flow HITL peer (refund saga bridge)

```bash
export AGENT_OS_FLOW_PEER=1
export AGENT_OS_HITL=1
# restart — boot prints "Flow HITL peer: on"
# Refund chat suspends AgentRun and mirrors WAITING on FlowEngine (ADR-003).
```

### D. Kubernetes dry-run appendix

```bash
npm run platform:k8s-dryrun
# see platform/APPENDIX-kubernetes.md
# runtimeClassName: kubernetes (not "nested") — does not replace local tour
```
