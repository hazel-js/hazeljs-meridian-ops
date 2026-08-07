import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { assertValidMarketplacePackage, loadMarketplacePackage } from '@hazeljs/agent';
import { PACKAGES } from '../scripts/dna-packages';

describe('Meridian DNA packages', () => {
  it('defines five marketplace packages', () => {
    expect(PACKAGES).toHaveLength(5);
    const names = PACKAGES.map((p) => p.name).sort();
    expect(names).toEqual([
      '@meridian/api-concierge-agent',
      '@meridian/fraud-triage-agent',
      '@meridian/router-agent',
      '@meridian/safe-desk-agent',
      '@meridian/support-desk-agent',
    ]);
  });

  it('each package validates', () => {
    for (const pkg of PACKAGES) {
      expect(() => assertValidMarketplacePackage(pkg)).not.toThrow();
    }
  });

  it('store:sync lock contains all names when present', () => {
    const lockPath = path.join(process.cwd(), '.hazel', 'agents', 'lock.json');
    if (!fs.existsSync(lockPath)) {
      console.warn('skip lock check — run npm run store:sync');
      return;
    }
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as Record<string, unknown>;
    for (const pkg of PACKAGES) {
      expect(lock[pkg.name]).toBeDefined();
    }
  });

  it('marketplace files round-trip after store:sync', () => {
    const file = path.join(process.cwd(), 'dna', 'support-desk.marketplace.json');
    if (!fs.existsSync(file)) return;
    const pkg = loadMarketplacePackage(file);
    expect(pkg.dna.name).toBe('support-desk');
  });
});
