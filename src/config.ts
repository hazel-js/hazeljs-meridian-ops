/** Shared runtime config for API base URL and Skillgate flags. */

import * as path from 'path';

export function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? '3060'}`;
}

/** Project-local package registry (clone-friendly; avoids writing ~/.hazel). */
export function projectRegistryRoot(projectRoot: string = process.cwd()): string {
  return (
    process.env.HAZEL_REGISTRY_ROOT?.trim() ||
    path.join(path.resolve(projectRoot), '.hazel', 'registry')
  );
}

export function skillgateFlags() {
  return {
    allowDestructive: process.env.SKILLGATE_ALLOW_DESTRUCTIVE === '1',
    allowAdmin: process.env.SKILLGATE_ALLOW_ADMIN === '1',
    ssrfProtection: process.env.SKILLGATE_SSRF === '1',
    hitl: process.env.SKILLGATE_HITL === '1',
    apiToken: process.env.API_TOKEN ?? '',
  };
}

/** Default on. Set AGENT_OS_GATEKEEPER=0 to fall back to PolicyEngine only. */
export function gatekeeperEnabled(): boolean {
  const v = process.env.AGENT_OS_GATEKEEPER?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off') return false;
  return true;
}

export function gatekeeperMode(): 'enforce' | 'audit' | 'disabled' {
  const v = process.env.AGENT_OS_GATEKEEPER_MODE?.trim().toLowerCase();
  if (v === 'audit' || v === 'disabled' || v === 'enforce') return v;
  return 'enforce';
}

export function meridianTenantId(): string {
  return process.env.MERIDIAN_TENANT_ID?.trim() || 'meridian';
}

export function meridianEnvironment(): string {
  return (
    process.env.GATEKEEPER_ENVIRONMENT?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'production' : 'development')
  );
}

export const AGENT_NAME = 'api-concierge';
