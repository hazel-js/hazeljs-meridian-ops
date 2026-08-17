# Kubernetes dry-run appendix (Phase 6)

Meridian’s default tour uses `runtimeClassName: local`. This appendix shows how a
**kubernetes** (alias `k8s`) Deployment is planned without a cluster.

> Naming note: DNA **source** may be `nested` vs `packageRef`. That is unrelated to
> `runtimeClassName`. Use `runtimeClassName: kubernetes` for this lab — not `nested`.

## Try

```bash
# After npm run store:sync (so packageRef resolves)
npm run platform:k8s-dryrun
```

Inspect `.hazel/platform/k8s-dryrun-resources.json` for the planned workload.
Default `npm run platform:sync` **does not** apply files under `platform/appendix/`.

## Not this

- Does not deploy Meridian to a cluster
- Does not replace `npm run platform:sync` / local backend
- Does not start or restart the Node process
