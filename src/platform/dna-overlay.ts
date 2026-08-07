/**
 * Phase 2b — wire local control plane DNA into the live AgentRuntime.
 *
 * Tools stay in app code (@Tool). Overlay applies prompt / model / description /
 * policies only — DNA tool stubs are stripped so hot-reload never replaces
 * real handlers with empty dynamic tools.
 *
 * Sources (first match wins per agent name):
 * 1. Applied AgentDefinitions in `.hazel/platform/resources.json`
 * 2. Optional file: AGENT_OS_DNA_OVERLAY_FILE or dna/support-desk.marketplace.json
 *
 * Disable with AGENT_OS_DNA_OVERLAY=0.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  createLocalPlatform,
  loadMarketplacePackage,
  parseDna,
  type AgentDna,
  type AgentDefinition,
  type AgentRuntime,
  type HotReloadResult,
} from '@hazeljs/agent';
import { projectRegistryRoot } from '../config';

export interface DnaOverlayEntry {
  source: 'platform' | 'file';
  definitionName?: string;
  result: HotReloadResult;
}

export interface DnaOverlayReport {
  enabled: boolean;
  applied: DnaOverlayEntry[];
  skipped: string[];
}

function overlayEnabled(): boolean {
  const v = process.env.AGENT_OS_DNA_OVERLAY?.trim();
  if (v === '0' || v === 'false' || v === 'off') return false;
  return true;
}

/** Prompt/policy/model overlay — never re-register DNA tool stubs. */
export function safeOverlayDna(dna: AgentDna): AgentDna {
  const { tools: _tools, ...rest } = dna;
  return parseDna(rest as AgentDna);
}

function defaultMarketplacePath(projectRoot: string): string {
  return (
    process.env.AGENT_OS_DNA_OVERLAY_FILE?.trim() ||
    path.join(projectRoot, 'dna', 'support-desk.marketplace.json')
  );
}

/** Load every `dna/*.marketplace.json` for agents not yet overlaid from platform. */
function dnaFromMarketplaceDir(projectRoot: string): AgentDna[] {
  const dir = path.join(projectRoot, 'dna');
  if (!fs.existsSync(dir)) return [];
  const out: AgentDna[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.marketplace.json')) continue;
    try {
      out.push(loadMarketplacePackage(path.join(dir, file)).dna);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[dna-overlay] skip ${file}: ${msg}`);
    }
  }
  return out;
}

function platformStorePath(projectRoot: string): string {
  return (
    process.env.AGENT_OS_PLATFORM_STORE?.trim() ||
    path.join(projectRoot, '.hazel', 'platform', 'resources.json')
  );
}

async function dnaFromPlatform(
  projectRoot: string
): Promise<Array<{ definitionName: string; dna: AgentDna }>> {
  const storePath = platformStorePath(projectRoot);
  if (!fs.existsSync(storePath)) return [];

  const platform = createLocalPlatform({
    storePath,
    projectRoot,
    registryRoot: projectRegistryRoot(projectRoot),
    events: false,
  });

  const defs = platform.repo.list({ kind: 'AgentDefinition' }) as AgentDefinition[];
  const out: Array<{ definitionName: string; dna: AgentDna }> = [];

  for (const def of defs) {
    try {
      const resolved = await platform.reconciler.resolveDefinition(def);
      out.push({ definitionName: def.metadata.name, dna: resolved.dna });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[dna-overlay] skip Definition "${def.metadata.name}": ${msg}`
      );
    }
  }
  return out;
}

function dnaFromFile(projectRoot: string): AgentDna | undefined {
  const filePath = defaultMarketplacePath(projectRoot);
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return loadMarketplacePackage(filePath).dna;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[dna-overlay] skip file ${filePath}: ${msg}`);
    return undefined;
  }
}

/**
 * Apply safe DNA overlays onto registered agents.
 * Idempotent; later sources for the same agent name are skipped.
 */
export async function applyDnaOverlays(
  runtime: AgentRuntime,
  projectRoot: string = process.cwd()
): Promise<DnaOverlayReport> {
  if (!overlayEnabled()) {
    return { enabled: false, applied: [], skipped: ['AGENT_OS_DNA_OVERLAY=0'] };
  }

  const applied: DnaOverlayEntry[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  const fromPlatform = await dnaFromPlatform(projectRoot);
  for (const { definitionName, dna } of fromPlatform) {
    if (!runtime.getAgentMetadata(dna.name)) {
      skipped.push(`platform:${definitionName} → agent "${dna.name}" not registered`);
      continue;
    }
    if (seen.has(dna.name)) {
      skipped.push(`platform:${definitionName} → "${dna.name}" already overlaid`);
      continue;
    }
    const result = runtime.hotReloadDna(safeOverlayDna(dna));
    seen.add(dna.name);
    applied.push({ source: 'platform', definitionName, result });
  }

  // File fallback for agents not already covered by platform Definitions.
  const fileDnas =
    process.env.AGENT_OS_DNA_OVERLAY_FILE?.trim()
      ? (() => {
          const one = dnaFromFile(projectRoot);
          return one ? [one] : [];
        })()
      : dnaFromMarketplaceDir(projectRoot);

  for (const fileDna of fileDnas) {
    if (!runtime.getAgentMetadata(fileDna.name)) {
      skipped.push(`file → agent "${fileDna.name}" not registered`);
      continue;
    }
    if (seen.has(fileDna.name)) {
      skipped.push(`file → "${fileDna.name}" already overlaid from platform`);
      continue;
    }
    const result = runtime.hotReloadDna(safeOverlayDna(fileDna));
    seen.add(fileDna.name);
    applied.push({ source: 'file', result });
  }
  if (!fromPlatform.length && !fileDnas.length) {
    skipped.push('no platform Definitions and no marketplace overlay files');
  }

  return { enabled: true, applied, skipped };
}

export function formatOverlayReport(report: DnaOverlayReport): string {
  if (!report.enabled) return 'DNA overlay disabled';
  if (!report.applied.length) {
    return `DNA overlay: nothing applied (${report.skipped.join('; ') || 'no sources'})`;
  }
  const lines = report.applied.map((e) => {
    const fields = e.result.updated.length ? e.result.updated.join(',') : 'no-op';
    const src =
      e.source === 'platform'
        ? `platform/${e.definitionName}`
        : 'file';
    return `${e.result.agentName}@${e.result.dnaVersion} ← ${src} [${fields}]`;
  });
  return `DNA overlay: ${lines.join('; ')}`;
}
