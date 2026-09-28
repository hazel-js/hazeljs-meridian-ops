/**
 * Durable AgentRun stores — file vs SQL from env (package helper).
 */

import {
  createDurableRunStoreFromEnv,
  durableRunStoreBackendFromEnv,
  type DurableRunStore,
  type DurableRunStoreBackend,
} from '@hazeljs/agent';

export type MeridianDurableBackend = DurableRunStoreBackend;

export function meridianDurableBackend(): MeridianDurableBackend {
  return durableRunStoreBackendFromEnv();
}

export function createMeridianDurableStore(): DurableRunStore {
  return createDurableRunStoreFromEnv();
}
