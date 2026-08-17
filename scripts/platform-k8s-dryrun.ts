/**
 * Phase 6 appendix — apply kubernetes dry-run Deployment without a cluster.
 * Not part of default `npm run platform:sync` (appendix/ is excluded).
 *
 *   npm run platform:k8s-dryrun
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLocalPlatform, parsePlatformDocuments } from '@hazeljs/agent';
import { projectRegistryRoot } from '../src/config';

async function main() {
  const root = process.cwd();
  const file = path.join(root, 'platform', 'appendix', 'support.kubernetes.yaml');
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}`);
  }

  const storePath = path.join(root, '.hazel', 'platform', 'k8s-dryrun-resources.json');
  const platform = createLocalPlatform({
    storePath,
    projectRoot: root,
    registryRoot: projectRegistryRoot(root),
    actor: 'platform-k8s-dryrun',
    // Force dry-run kubernetes backend — no kubeconfig required.
    kubernetes: true,
  });

  const docs = parsePlatformDocuments(fs.readFileSync(file, 'utf8'));
  const applied: Array<Record<string, unknown>> = [];
  for (const doc of docs) {
    const result = await platform.reconciler.applyResource(doc);
    applied.push({
      kind: result.resource.kind,
      name: result.resource.metadata.name,
      ready: result.ready,
      message: result.message,
      runtimeClassName: (result.resource as { spec?: { runtimeClassName?: string } }).spec
        ?.runtimeClassName,
    });
  }

  const reconcile = await platform.reconcileAll();
  console.log(
    JSON.stringify(
      {
        note: 'Appendix only — does not replace local runtimeClassName: local tour',
        storePath,
        applied,
        reconcile: {
          ready: reconcile.ready,
          notReady: reconcile.notReady,
          errors: reconcile.errors,
        },
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
