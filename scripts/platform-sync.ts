/**
 * Apply + reconcile Meridian platform manifests.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLocalPlatform, parsePlatformDocuments } from '@hazeljs/agent';
import { projectRegistryRoot } from '../src/config';

async function main() {
  const root = process.cwd();
  const platformDir = path.join(root, 'platform');
  const files =
    process.argv.slice(2).length > 0
      ? process.argv.slice(2)
      : fs
          .readdirSync(platformDir)
          .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
          .map((f) => path.join('platform', f));

  const storePath = path.join(root, '.hazel', 'platform', 'resources.json');
  const platform = createLocalPlatform({
    storePath,
    projectRoot: root,
    registryRoot: projectRegistryRoot(root),
    actor: 'platform-sync',
  });

  const applied: Array<Record<string, unknown>> = [];
  for (const rel of files) {
    const filePath = path.resolve(root, rel);
    if (!fs.existsSync(filePath)) throw new Error(`Manifest not found: ${filePath}`);
    const docs = parsePlatformDocuments(fs.readFileSync(filePath, 'utf8'));
    for (const doc of docs) {
      const result = await platform.reconciler.applyResource(doc);
      applied.push({
        file: rel,
        kind: result.resource.kind,
        name: result.resource.metadata.name,
        ready: result.ready,
        message: result.message,
        generation: result.resource.metadata.generation,
      });
    }
  }

  const reconcile = await platform.reconcileAll();
  console.log(
    JSON.stringify(
      {
        storePath,
        applied,
        reconcile: {
          ready: reconcile.ready,
          notReady: reconcile.notReady,
          errors: reconcile.errors,
        },
        next: 'Restart npm run dev — DNA overlay reads platform store on boot',
      },
      null,
      2
    )
  );

  if (applied.some((r) => r.ready === false) || reconcile.errors.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
