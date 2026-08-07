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

export const AGENT_NAME = 'api-concierge';
