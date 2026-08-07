# Platform manifests (local control plane)

Full story (purpose, when useful, sync → overlay workflow): **[README — DNA and platform](../README.md#dna-and-platform--purpose)**.

**Problem:** People confuse `hazel agent apply` with “run the agent” or “deploy to Kubernetes.”

| Command | What it does |
| --- | --- |
| `npm run platform:sync` / `hazel agent apply -f …` | Writes desired AgentDefinition / AgentDeployment into `.hazel/platform/resources.json` |
| `hazel agent reconcile` | Converges local backend observations |
| `npm run dev` + `/api/chat` | **Runs** agents with real `@Tool` handlers |
| `hazel agent run dna/…` | DNA smoke with **stubs** — not product behavior |

Meridian defaults to `runtimeClassName: local`. Cloud registry and K8s are optional and not required for the tour.

After apply, restart (or let ts-node-dev respawn) so `AGENT_OS_DNA_OVERLAY` can hot-reload prompt/policies from the platform store.
