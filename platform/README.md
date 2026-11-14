# Platform manifests (local control plane)

Full story (both DNA paths, pros/cons, workflows): **[README — DNA and platform](../README.md#dna-and-platform--purpose)**.

**Problem:** People confuse `hazel agent apply` with “run the agent” or “deploy to Kubernetes.”

| Command | What it does |
| --- | --- |
| `npm run platform:sync` / `hazel agent apply -f …` | Writes desired AgentDefinition / AgentDeployment into `.hazel/platform/resources.json` |
| `hazel agent reconcile` | Converges local backend observations |
| `npm run dev` + `/api/chat` | **Runs** agents with real `@Tool` handlers |
| `hazel agent run dna/…` | DNA smoke with **stubs** — not product behavior |

## How this relates to decorator DNA

Meridian has **two** DNA apply paths:

| Path | Used by | Needs platform sync? |
| --- | --- | --- |
| **Decorator** `@Agent({ dna: true })` | **`safe-desk`** | No — loads `dna/safe-desk.dna.json` on register |
| **Boot overlay** from store/platform | support-desk, fraud, helpdesk, … | Yes — sync then restart so overlay runs |

Platform manifests only feed the **overlay** path. Editing `platform/*.yaml` does not change `safe-desk` unless you also change its DNA file (decorator) or point a Definition at it via overlay.

**Pros of platform/overlay:** env desired state, `packageRef` pins, audit trail under `.hazel/platform/`.  
**Cons:** extra sync steps; apply alone never updates live chat until boot overlay.

Meridian defaults to `runtimeClassName: local`. Cloud registry and K8s are optional and not required for the tour.

Kubernetes dry-run appendix (does **not** run in default `platform:sync`):

```bash
npm run platform:k8s-dryrun
# see APPENDIX-kubernetes.md — runtimeClassName: kubernetes
```

After apply, restart (or let ts-node-dev respawn) so `AGENT_OS_DNA_OVERLAY` can hot-reload prompt/policies from the platform store for the fleet. `AGENT_OS_DNA_OVERLAY=0` turns off overlay only — `safe-desk` decorator DNA still loads.
