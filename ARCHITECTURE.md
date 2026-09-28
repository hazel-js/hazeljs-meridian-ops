# Meridian architecture

Short reference. **Purpose + workflows for DNA/platform:** see [README.md](./README.md#dna-and-platform--purpose).

## Layers

```text
HTTP /api/chat
    → AgentRuntime
        → Agent Gatekeeper (authorize every tool call — default deny)
        → Agent VM EffectGate (optional — effect lattice + journal)
        → ops-router (@Delegate) → specialists
        → support-desk / fraud-triage (@Tool in app code)
        → helpdesk (in-memory KB via enableRAG)
        → api-concierge (Skillgate-registered HTTP skills)

DNA packages (dna/*.marketplace.json)
    → hazel store publish / npm run store:sync
    → .hazel/agents + lock.json
    → optional remote publish (store:sync:remote)

Platform manifests (platform/*.yaml)
    → npm run platform:sync
    → .hazel/platform/resources.json
    → boot overlay (prompt/policies only; tools stay in code)

Durable store
    → file (.hazel/runs) default | Prisma SQL (AGENT_OS_DURABLE_BACKEND=sql)
```

## DNA ≠ implementation

| Artifact | Owns |
| --- | --- |
| Marketplace DNA | Identity, prompt, tool *names*, policies, contracts |
| TypeScript `@Tool` / Skillgate invokers | Real side effects |
| AgentDefinition `packageRef` XOR nested `dna` | One canonical DNA per Definition (Model B) |

## Store vs platform vs run

- **Store** versions portable agent packages (local registry; optional remote).
- **Platform** declares desired Definitions/Deployments/Runs for the local control plane.
- **Runtime** executes steps, HITL, recovery — always.
- **Gatekeeper** (`@hazeljs/agent-gatekeeper`) authorizes each tool invocation (default deny). In-memory audit/approvals are tests-only; Meridian uses durable HITL + console audit, optional Redis.
- **Agent VM** (`@hazeljs/agent-vm`, `AGENT_OS_AGENT_VM=1`) enforces effect types on tools, journals reversible side effects, and exposes a travel speculation lab. Support-desk `lookupOrder`/`trackShipment` are `@Read`; `processRefund` is `@Reversible` with `@Compensate`.
- **Overlay** bridges platform/file DNA → live prompt/policies on boot (`AGENT_OS_DNA_OVERLAY`).

## OSS vs Cloud

Local registry + local backend are enough for correctness. Hosted registry (`HAZEL_REGISTRY_URL`) is a Team SKU for promote/share — never required to chat.

## Phase 6 (optional)

| Piece | Env / command |
| --- | --- |
| SQL durable | `AGENT_OS_DURABLE_BACKEND=sql` + `DATABASE_URL` |
| Flow HITL peer | `AGENT_OS_FLOW_PEER=1` |
| RAG helpdesk | `/api/helpdesk/chat` |
| K8s dry-run | `npm run platform:k8s-dryrun` (`runtimeClassName: kubernetes`) |
