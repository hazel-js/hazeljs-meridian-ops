/**
 * Build the Meridian Agent Gatekeeper: enforce + default deny, durable HITL,
 * JSON audit on stdout. Redis / OTEL are opt-in via env.
 */

import {
  AgentGatekeeper,
  CompositeAuditSink,
  ConsoleAuditSink,
  createHumanTaskProvider,
  createOtelAuditSink,
  createRedisApprovalProvider,
  InMemoryApprovalProvider,
  InMemoryAuditSink,
  type AgentGatekeeperPolicy,
  type ApprovalProvider,
  type AuditSink,
  type RedisApprovalCommands,
} from '@hazeljs/agent-gatekeeper';
import {
  gatekeeperEnabled,
  gatekeeperMode,
  meridianEnvironment,
  meridianTenantId,
} from '../config';
import { createMeridianAuthorizationGate, type HumanTaskLookup } from './authorization-gate';
import { createMeridianPolicies } from './policies';

export interface MeridianHumanTasks extends HumanTaskLookup {
  create(input: {
    id?: string;
    runId: string;
    type: 'tool_approval' | 'user_input' | 'review';
    toolName?: string;
    payload?: unknown;
    metadata?: unknown;
  }): Promise<{ id: string }>;
  get(id: string): Promise<{ status?: string; payload?: unknown; metadata?: unknown } | undefined>;
  resolve(
    id: string,
    decision: 'approved' | 'rejected' | 'expired',
    resolvedBy?: string
  ): Promise<unknown>;
}

export interface MeridianGatekeeperBundle {
  enabled: boolean;
  gatekeeper: AgentGatekeeper;
  approvalProvider: ApprovalProvider;
  authorizationGate: ReturnType<typeof createMeridianAuthorizationGate>;
  policies: AgentGatekeeperPolicy[];
  approvalBackend: 'human-task' | 'redis' | 'memory';
  auditBackend: string;
}

const bound = new WeakMap<object, MeridianGatekeeperBundle>();

export function bindGatekeeper(runtime: object, bundle: MeridianGatekeeperBundle): void {
  bound.set(runtime, bundle);
}

export function gatekeeperFor(runtime: object): MeridianGatekeeperBundle | undefined {
  return bound.get(runtime);
}

function createAuditSink(): { sink: AuditSink; backend: string } {
  if (process.env.JEST_WORKER_ID !== undefined) {
    return { sink: new InMemoryAuditSink(), backend: 'memory' };
  }
  const parts: AuditSink[] = [new ConsoleAuditSink()];
  const labels = ['console'];

  try {
    // Optional: present when the process is already instrumented.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const otel = require('@opentelemetry/api') as { trace?: { getTracer: unknown } };
    if (otel?.trace) {
      parts.push(createOtelAuditSink({ trace: otel.trace as never }));
      labels.push('otel');
    }
  } catch {
    /* peer not installed */
  }

  return {
    sink: parts.length === 1 ? parts[0] : new CompositeAuditSink(parts),
    backend: labels.join('+'),
  };
}

function redisFromEnv(): RedisApprovalCommands | undefined {
  const url = process.env.GATEKEEPER_REDIS_URL?.trim() || process.env.REDIS_URL?.trim();
  if (!url) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('redis') as {
      createClient: (opts: { url: string }) => {
        get(key: string): Promise<string | null>;
        setEx(key: string, seconds: number, value: string): Promise<unknown>;
        del(key: string): Promise<unknown>;
        connect?: () => Promise<unknown>;
        isOpen?: boolean;
      };
    };
    const client = createClient({ url });
    void client.connect?.();
    return client;
  } catch {
    console.warn(
      'GATEKEEPER_REDIS_URL is set but the `redis` package is not installed — using durable HITL approvals'
    );
    return undefined;
  }
}

export function createMeridianGatekeeper(opts: {
  humanTasks?: MeridianHumanTasks;
}): MeridianGatekeeperBundle {
  const policies = createMeridianPolicies();
  const redis = redisFromEnv();
  let approvalProvider: ApprovalProvider;
  let approvalBackend: MeridianGatekeeperBundle['approvalBackend'];

  if (redis) {
    approvalProvider = createRedisApprovalProvider(redis);
    approvalBackend = 'redis';
  } else if (opts.humanTasks) {
    approvalProvider = createHumanTaskProvider(opts.humanTasks);
    approvalBackend = 'human-task';
  } else {
    approvalProvider = new InMemoryApprovalProvider();
    approvalBackend = 'memory';
  }

  const { sink, backend: auditBackend } = createAuditSink();
  const enabled = gatekeeperEnabled();

  const gatekeeper = new AgentGatekeeper({
    mode: enabled ? gatekeeperMode() : 'disabled',
    defaultDecision: 'deny',
    policies,
    approvalProvider,
    auditSink: sink,
  });

  const authorizationGate = createMeridianAuthorizationGate(gatekeeper, {
    humanTasks: opts.humanTasks,
  });

  return {
    enabled,
    gatekeeper,
    approvalProvider,
    authorizationGate,
    policies,
    approvalBackend,
    auditBackend,
  };
}

export function formatGatekeeperBoot(bundle: MeridianGatekeeperBundle): string {
  if (!bundle.enabled) return 'Gatekeeper: off (PolicyEngine)';
  return `Gatekeeper: ${bundle.gatekeeper.mode} · deny · ${bundle.policies.length} policies · approvals=${bundle.approvalBackend} · audit=${bundle.auditBackend} · tenant=${meridianTenantId()} · env=${meridianEnvironment()}`;
}
