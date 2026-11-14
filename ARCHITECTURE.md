# Meridian architecture

Short reference. **DNA paths, pros/cons, workflows:** [README — DNA and platform](./README.md#dna-and-platform--purpose).

## Layers

```text
HTTP /api/chat · /api/support/chat · /api/helpdesk/chat · /api/ops/chat · /api/fraud/chat
    → AgentRuntime
        → Agent Gatekeeper (authorize every tool call — default deny)
        → Decision Runtime (/api/decision/refund — closed-set + HITL, then Gatekeeper)
        → Autonomous Runtime (/api/autonomous/* — @Injectable order-ops, then Gatekeeper)
        → Agent VM EffectGate (optional — effect lattice + journal)
        → ops-router (@Delegate) → specialists
        → support-desk / fraud-triage (@Tool in app code)
        → safe-desk (@Agent({ dna: true }) → dna/safe-desk.dna.json on register)
        → helpdesk (in-memory RAG KB — always registered)
        → api-concierge (Skillgate-registered HTTP skills)

DNA apply path A — decorator (safe-desk)
    → @Agent({ dna: true }) + projectRoot
    → load dna/safe-desk.dna.json on registerAgentInstance
    → prompt / model / PolicyEngine merge (handlers stay in @Tool)

DNA apply path B — store + platform (fleet)
    → dna/*.marketplace.json
    → hazel store publish / npm run store:sync
    → .hazel/agents + lock.json
    → optional remote publish (store:sync:remote)
    → platform/*.yaml → npm run platform:sync → .hazel/platform/resources.json
    → boot applyDnaOverlays (prompt/policies only; tools stay in code)

Durable store
    → file (.hazel/runs) default | Prisma SQL (AGENT_OS_DURABLE_BACKEND=sql)

Context labs (not in AgentRuntime)
    → npm run example:rag | example:cag | example:kag | example:context
```

## DNA ≠ implementation

| Artifact | Owns |
| --- | --- |
| DNA file / marketplace package | Identity, prompt, tool *names*, policies, contracts |
| TypeScript `@Tool` / Skillgate invokers | Real side effects |
| `@Agent({ dna: true })` | Opt-in: load DNA file for *this* class on register |
| AgentDefinition `packageRef` XOR nested `dna` | One canonical DNA per Definition (Model B) for overlay path |

## Decorator DNA vs store/platform

| | Decorator (`safe-desk`) | Store + overlay (fleet) |
| --- | --- | --- |
| Pros | Simple; no sync; per-agent opt-in | Versioned packages; env promote; audit desired state |
| Cons | No lock/registry; weak multi-env | Sync steps; files alone do not change live agents |
| When | Workshops, single-app agents | Staging→prod pins, shared registry |

Keep **both**: default DX = decorator; Agent OS packaging = store/platform. Details and mermaid: [README](./README.md#two-dna-apply-paths-keep-both).

## Store vs platform vs run

- **Store** versions portable agent packages (local registry; optional remote).
- **Platform** declares desired Definitions/Deployments/Runs for the local control plane.
- **Runtime** executes steps, HITL, recovery — always.
- **Gatekeeper** (`@hazeljs/agent-gatekeeper`) authorizes each tool invocation (default deny). In-memory audit/approvals are tests-only; Meridian uses durable HITL + console audit, optional Redis.
- **Agent VM** (`@hazeljs/agent-vm`, `AGENT_OS_AGENT_VM=1`) enforces effect types on tools, journals reversible side effects, and exposes a travel speculation lab. Support-desk `lookupOrder`/`trackShipment` are `@Read`; `processRefund` is `@Reversible` with `@Compensate`.
- **Decision** (`@hazeljs/decision`) chooses `approve | reject | review` then Gatekeeper executes; confidence ≠ permission.
- **Autonomous** (`@hazeljs/autonomous`) governs ordinary `@Injectable` services (`@Autonomous` / `@Observe` / `@Capability`) — observe → decide → HITL → Gatekeeper → capability. Not a second `@Agent` loop.
- **Decorator DNA** loads `dna/{name}.dna.json` when the class opts in (`safe-desk`).
- **Overlay** bridges platform/file DNA → live prompt/policies on boot for the rest of the fleet (`AGENT_OS_DNA_OVERLAY`).
- **RAG helpdesk** is live (`POST /api/helpdesk/chat`). CAG / KAG / `@hazeljs/context` are offline labs under `examples/` — not injected on AgentRuntime.

## OSS vs Cloud

Local registry + local backend are enough for correctness. Hosted registry (`HAZEL_REGISTRY_URL`) is a Team SKU for promote/share — never required to chat. Decorator DNA does not need a registry at all.

## Optional labs

| Piece | Env / command |
| --- | --- |
| SQL durable | `AGENT_OS_DURABLE_BACKEND=sql` + `DATABASE_URL` |
| Flow HITL peer | `AGENT_OS_FLOW_PEER=1` |
| Agent VM | `AGENT_OS_AGENT_VM=1` + `/api/agent-vm/*` |
| Context labs | `npm run example:rag` · `example:cag` · `example:kag` · `example:context` |
| Autonomous lab | `npm run example:autonomous` (live twin: `/api/autonomous/*`) |
| K8s dry-run | `npm run platform:k8s-dryrun` (`runtimeClassName: kubernetes`) |
| Decorator DNA smoke | `npx jest tests/safe-desk-decorator-dna.test.ts` |
