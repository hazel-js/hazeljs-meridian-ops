# Meridian 15-minute tour

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

Boot log should show Skillgate report + `DNA overlay: …`.

## 3. Track an order (F1–F2)

```bash
curl -s localhost:3060/api/support/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Where is my package for ORD-1001?"}' | jq .
```

## 4. Refund HITL off then on (F7–F8)

```bash
# Auto-approve (default AGENT_OS_HITL=0)
curl -s localhost:3060/api/support/chat \
  -H 'content-type: application/json' \
  -d '{"message":"I want a refund for ORD-1002"}' | jq .

# Real HITL: set AGENT_OS_HITL=1, restart, then:
# curl … refund … → pendingApproval.requestId
# curl -s -X POST localhost:3060/api/approvals/<id>/approve | jq .
```

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

Point `HAZEL_REGISTRY_URL` + `HAZEL_REGISTRY_TOKEN` at slimmed `hazeljs-cloud-backend`. Local run never requires Cloud.
