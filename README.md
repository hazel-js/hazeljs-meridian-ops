# Meridian Ops Platform

**Tagline:** Ship AI workers as part of your backend — versioned like packages, governed like APIs, declared like infrastructure.

Canonical HazelJS Agent OS flagship. Absorbs patterns from `hazeljs-agent-os-starter` + `hazeljs-skillgate-agent-starter` and wires the local control plane from `@hazeljs/agent`.

## Quick start

```bash
cp -n .env.example .env
npm install
npm run store:sync      # publish 6 DNA → .hazel/agents + lock
npm run platform:sync   # apply manifests → .hazel/platform
npm run tour            # F1–F22 map + curls
npm run dev             # http://localhost:3060
```

Leave `OPENAI_API_KEY` empty (DemoLLM). Set `AGENT_OS_HITL=1` for real approval pauses.

Boot log should show Skillgate report + `DNA overlay: …` + `Gatekeeper: enforce · deny · …`.

![Meridian tour flow](./docs/assets/meridian-tour.svg)

### Feature: HITL refunds

**Problem:** Auto-refunds lose money when the model is wrong or the process restarts.  
**How Meridian does it:** `@hazeljs/agent-gatekeeper` requires approval on `processRefund` (default deny for unknown tools) + durableSuspend; approve via API.  
**Try:** `AGENT_OS_HITL=1` + `POST /api/support/chat` + `POST /api/approvals/:id/approve`.  
**Not this:** `hazel agent run` stubs — they don't move money.

### Feature: Agent Gatekeeper

**Problem:** PolicyEngine on the runtime is skipped once an authorization gate is set; in-memory audit/approvals do not survive a second replica.  
**How Meridian does it:** `authorizationGate` on AgentRuntime, durable HumanTask approvals, console JSON audit. Optional `GATEKEEPER_REDIS_URL` for multi-replica consume. MCP `tools/call` is wrapped with `protectMcpInvoke`.  
**Try:** `GET /api/gatekeeper/status` and `npm run gatekeeper:validate`.  
**Off:** `AGENT_OS_GATEKEEPER=0` falls back to PolicyEngine only.

### Phase 6 (optional v1.1)

| Lab | How |
| --- | --- |
| SQL durable runs | `AGENT_OS_DURABLE_BACKEND=sql` + `npm run db:push` |
| RAG helpdesk | `POST /api/helpdesk/chat` + `@meridian/helpdesk-agent` |
| Flow HITL peer | `AGENT_OS_FLOW_PEER=1` (ADR-003 mirror on refund pause) |
| Remote registry | `npm run store:sync:remote` with `HAZEL_REGISTRY_*` |
| K8s dry-run | `npm run platform:k8s-dryrun` — see [platform/APPENDIX-kubernetes.md](./platform/APPENDIX-kubernetes.md) |

Details: [TOUR.md](./TOUR.md#phase-6-labs-optional--skip-on-first-pass).

---

## DNA and platform — purpose

Meridian is a **normal TypeScript backend** (`npm run dev`). Chat, tools, HITL, and Skillgate all run inside that process.

DNA and the platform control plane sit **beside** that runtime. They answer different questions:

| Piece | Question it answers |
| --- | --- |
| **App code** (`@Agent` / `@Tool` / Skillgate) | What can this agent *do*? (orders DB, refunds, freezes) |
| **DNA** (`dna/*.marketplace.json`) | Who is this agent *as a package*? (name, prompt, tool names, policies, version) |
| **Store** (`store:sync`) | How do we *version and share* that package? (registry + `.hazel/agents` lock) |
| **Platform** (`platform:sync` / `hazel agent apply`) | What should *this environment* run? (Definitions / Deployments as desired state) |
| **Runtime** (`POST /api/chat`) | What happens *right now*? (steps, HITL, timeline) |
| **Gatekeeper** (`@hazeljs/agent-gatekeeper`) | May this agent call this tool *now*? (default deny, HITL, audit) |

**DNA ≠ implementation.** DNA lists tool *names* and policies; real side effects stay in TypeScript. Overlay never replaces `@Tool` handlers with empty stubs.

**Platform ≠ deploy-your-Node-app.** `apply` writes desired state under `.hazel/platform/`. It does not start or restart Meridian by itself. K8s (`runtimeClassName: kubernetes`) is optional and separate from the default local tour.

### When this is useful (practical)

**1. Change tone / policy without rewriting tools**  
Legal wants refunds to say “3–5 business days” and never invent tracking numbers. You bump DNA `systemPrompt` + keep `require_approval` on `processRefund`, sync store/platform, restart — same `@Tool` code, new governed prompt.

**2. Promote the same agent across envs**  
Staging validated `@meridian/support-desk-agent@1.0.1`. Prod pins the same `packageRef` / lock, syncs, restarts. Store = what the agent is; platform = what this env wants; runtime = what executes.

**3. Ops / audit**  
On-call asks “what config is this env supposed to run?” → `describe` / `.hazel/platform/resources.json` / events. Chat logs show live behavior; platform shows **desired** state.

**When to ignore DNA/platform and just edit code:** new tools (`cancelOrder`), Skillgate route bugs, DemoLLM fixes — ship TypeScript and let `ts-node-dev` respawn.

---

## DNA and platform — workflow

```text
dna/*.marketplace.json
        │  npm run store:sync
        ▼
  local registry + .hazel/agents/ + lock.json
        │
platform/*.yaml  (nested dna  OR  packageRef → store)
        │  npm run platform:sync
        ▼
  .hazel/platform/resources.json   (+ events.jsonl)
        │  npm run dev  (AGENT_OS_DNA_OVERLAY=1)
        ▼
  AgentRuntime overlays prompt / model / policies
  Agent Gatekeeper authorizes each tool call (default deny)
  Tools still come from app @Tool / Skillgate
        │
        ▼
  POST /api/chat  → real product behavior
```

### Step-by-step: update a prompt and see it live

1. Edit `dna/support-desk.marketplace.json` (`systemPrompt`) — or nested DNA in `platform/support.agents.yaml`.
2. `npm run store:sync` — publish + materialize (needed for `packageRef` path).
3. `npm run platform:sync` — apply Definitions/Deployments into `.hazel/platform/`.
4. Restart `npm run dev` (or wait for respawn) — boot runs DNA overlay.
5. Check: boot line `DNA overlay: support-desk@… ← platform/…` and  
   `curl -s localhost:3060/api/support/dna | jq -r .systemPrompt` (or chat).

Disable overlay with `AGENT_OS_DNA_OVERLAY=0` (decorator metadata only).

### What changes the live app?

| You change… | Live process updates when… |
| --- | --- |
| DNA prompt / policies | Restart (or explicit DNA reload) **with overlay on** |
| Platform YAML only | Sync + restart/overlay — apply alone is not enough |
| `@Tool` / controllers | Code reload / restart — DNA does not implement tools |
| `hazel agent apply` alone | **Nothing** in chat until the app overlays |

`apply` / `store:sync` are **safe to run while the server is up**; they only update files. Meridian reads them on the next boot overlay.

---

## Anti-confusion

| Command | Real tools? | Use for |
| --- | --- | --- |
| `hazel agent run dna/…` | No (stubs) | Package/DNA smoke |
| `hazel agent apply` / `npm run platform:sync` | N/A | Declare Definition/Deployment |
| `hazel agent reconcile` | N/A | Converge local backend |
| `npm run store:sync` | N/A | Publish DNA + lockfile |
| `npm run dev` + `/api/chat` | Yes | Product behavior |
| `npm run mcp` | Yes (HTTP to API) | IDE tools |
| `hazel store … --remote` | N/A | Optional Cloud registry (Journey D) |

## Agents

| Agent | Role |
| --- | --- |
| `ops-router` | Default `POST /api/chat` — delegates |
| `support-desk` | Orders / tracking / refunds |
| `safe-desk` | Read-only fallback / twin |
| `api-concierge` | Skillgate REST skills |
| `fraud-triage` | Risk + HITL freeze |
| `helpdesk` | RAG policy FAQ (`POST /api/helpdesk/chat`) |

## Docs

- [TOUR.md](./TOUR.md) — 15-minute walkthrough + Phase 6 labs  
- [ARCHITECTURE.md](./ARCHITECTURE.md) — layer diagram (short)  
- [agent-gatekeeper.yaml](./agent-gatekeeper.yaml) — CI policy file (`npm run gatekeeper:validate`)  
- [platform/README.md](./platform/README.md) — apply vs run  
- [platform/APPENDIX-kubernetes.md](./platform/APPENDIX-kubernetes.md) — k8s dry-run  

## Compared to other entry points

| Asset | Use when |
| --- | --- |
| **`hazeljs-meridian-ops` (this repo)** | Learn the full Agent OS + DNA + Store + Skillgate + Gatekeeper + router + apply story |
| `hazeljs-agent-os-starter` | Minimal support-desk template |
| `hazeljs-skillgate-agent-starter` | Skillgate-only thin template |
| `hazel agent new --template agent-os` | Scaffold a new empty desk to grow toward Meridian |
| `docs/agent-os-platform/examples/` | Manifest YAML samples without a product app |
