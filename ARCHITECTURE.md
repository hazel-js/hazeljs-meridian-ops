# Meridian architecture

Short reference. **Purpose + workflows for DNA/platform:** see [README.md](./README.md#dna-and-platform--purpose).

## Layers

```text
HTTP /api/chat
    → AgentRuntime (execute, HITL, timeline)
        → ops-router (@Delegate) → specialists
        → support-desk / fraud-triage (@Tool in app code)
        → api-concierge (Skillgate-registered HTTP skills)

DNA packages (dna/*.marketplace.json)
    → hazel store publish / npm run store:sync
    → .hazel/agents + lock.json

Platform manifests (platform/*.yaml)
    → npm run platform:sync
    → .hazel/platform/resources.json
    → boot overlay (prompt/policies only; tools stay in code)
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
- **Overlay** bridges platform/file DNA → live prompt/policies on boot (`AGENT_OS_DNA_OVERLAY`).

## OSS vs Cloud

Local registry + local backend are enough for correctness. Hosted registry (`HAZEL_REGISTRY_URL`) is a Team SKU for promote/share — never required to chat.
