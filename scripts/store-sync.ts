/**
 * Publish all Meridian DNA packages to local registry + materialize into .hazel/agents.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  assertValidMarketplacePackage,
  LocalFsAgentRegistry,
  materializeAgentPackage,
  type MarketplaceAgentPackage,
} from '@hazeljs/agent';
import { projectRegistryRoot } from '../src/config';
import { PACKAGES } from './dna-packages';

async function main() {
  const root = process.cwd();
  const dnaDir = path.join(root, 'dna');
  fs.mkdirSync(dnaDir, { recursive: true });

  const registry = new LocalFsAgentRegistry({ rootDir: projectRegistryRoot(root) });
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

    registry.publish(pkg);
    const mat = materializeAgentPackage(pkg, root);
    lockNames.push(pkg.name);
    console.log(`✓ ${pkg.name}@${pkg.version} → ${mat.packagePath}`);
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
        registryRoot: registry.rootDir,
        lockPath,
        packages: lockNames,
        next: ['npm run platform:sync', 'npm run dev'],
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
