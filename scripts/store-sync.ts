/**
 * Publish all Meridian DNA packages to local (default) or remote registry + materialize.
 *
 * Local (default):
 *   npm run store:sync
 *
 * Remote (Journey D / F22) — requires HAZEL_REGISTRY_URL (+ optional TOKEN):
 *   npm run store:sync:remote
 *   # or: npm run store:sync -- --remote
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  assertValidMarketplacePackage,
  createAgentPackageRegistry,
  LocalFsAgentRegistry,
  materializeAgentPackage,
  type MarketplaceAgentPackage,
} from '@hazeljs/agent';
import { projectRegistryRoot } from '../src/config';
import { PACKAGES } from './dna-packages';

function wantsRemote(argv: string[]): boolean {
  return argv.includes('--remote') || argv.includes('--remote=1');
}

async function main() {
  const root = process.cwd();
  const dnaDir = path.join(root, 'dna');
  fs.mkdirSync(dnaDir, { recursive: true });

  const remote = wantsRemote(process.argv.slice(2));
  const localRegistry = new LocalFsAgentRegistry({ rootDir: projectRegistryRoot(root) });
  const remoteRegistry = remote
    ? createAgentPackageRegistry({
        remote: process.env.HAZEL_REGISTRY_URL,
        token: process.env.HAZEL_REGISTRY_TOKEN,
      })
    : null;

  if (remote && !process.env.HAZEL_REGISTRY_URL?.trim()) {
    throw new Error('Remote sync requested but HAZEL_REGISTRY_URL is empty');
  }

  if (remoteRegistry) {
    const doctor = await remoteRegistry.doctor();
    console.log(
      JSON.stringify(
        { remoteDoctor: doctor, location: remoteRegistry.location, kind: remoteRegistry.kind },
        null,
        2
      )
    );
  }

  const lockNames: string[] = [];

  for (const raw of PACKAGES) {
    const pkg = raw as MarketplaceAgentPackage;
    assertValidMarketplacePackage(pkg);
    const base = pkg.dna.name;
    fs.writeFileSync(
      path.join(dnaDir, `${base}.marketplace.json`),
      JSON.stringify(pkg, null, 2)
    );
    fs.writeFileSync(path.join(dnaDir, `${base}.dna.json`), JSON.stringify(pkg.dna, null, 2));

    // Always materialize locally so the app can overlay without Cloud.
    localRegistry.publish(pkg);
    if (remoteRegistry) {
      await remoteRegistry.publish(pkg);
    }
    const mat = materializeAgentPackage(pkg, root);
    lockNames.push(pkg.name);
    console.log(
      `✓ ${pkg.name}@${pkg.version} → ${mat.packagePath}${remote ? ' (+ remote publish)' : ''}`
    );
  }

  const lockPath = path.join(root, '.hazel', 'agents', 'lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as Record<string, unknown>;
  const missing = lockNames.filter((n) => !(n in lock));
  if (missing.length) {
    throw new Error(`Lock missing packages: ${missing.join(', ')}`);
  }

  console.log(
    JSON.stringify(
      {
        published: lockNames.length,
        remote,
        registryRoot: localRegistry.rootDir,
        lockPath,
        packages: lockNames,
        next: remote
          ? ['Local lock still authoritative for Meridian boot', 'npm run platform:sync', 'npm run dev']
          : ['npm run platform:sync', 'npm run dev'],
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
