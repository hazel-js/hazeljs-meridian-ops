/**
 * WHY: File durable runs stay the clone default; SQL (Prisma) is the Phase 6 production-shaped profile.
 */

import * as path from 'path';
import {
  createDurableRunStore,
  createSqlDurableRunStore,
  type DurableRunStore,
} from '@hazeljs/agent';

export type MeridianDurableBackend = 'file' | 'sql';

export function meridianDurableBackend(): MeridianDurableBackend {
  const raw = (process.env.AGENT_OS_DURABLE_BACKEND ?? 'file').trim().toLowerCase();
  return raw === 'sql' ? 'sql' : 'file';
}

export function createMeridianDurableStore(): DurableRunStore {
  if (meridianDurableBackend() === 'sql') {
    // Lazy require so file-backend clones do not need a generated Prisma client.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client') as {
      PrismaClient: new () => unknown;
    };
    const prisma = new PrismaClient();
    return createSqlDurableRunStore(prisma as never);
  }

  const durableDir =
    process.env.AGENT_OS_DURABLE_DIR ?? path.join(process.cwd(), '.hazel', 'runs');
  return createDurableRunStore(durableDir);
}
