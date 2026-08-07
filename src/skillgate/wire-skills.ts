/**
 * Register Skillgate skills onto an AgentRuntime and print a governance report.
 */

import type { AgentRuntime } from '@hazeljs/agent';
import type { Skillgate, SkillgateReport } from '@hazeljs/skillgate';
import { AGENT_NAME } from '../config';
import { buildGateFromModule } from './build-gate';
import { toolRegistryOf } from './tool-registry';

export function formatReport(report: SkillgateReport): string {
  const lines: string[] = [];
  lines.push('┌─ Skillgate report ─────────────────────────────────────────────');
  lines.push(`│ Included (${report.included.length}):`);
  for (const s of report.included) {
    const flags = [
      s.class,
      s.readOnly ? 'readOnly' : null,
      s.requiresApproval ? 'approval' : null,
    ]
      .filter(Boolean)
      .join(', ');
    lines.push(`│   ✓ ${s.name.padEnd(18)} ${s.method.padEnd(6)} ${s.path}  [${flags}]`);
  }
  lines.push(`│ Denied (${report.denied.length}):`);
  for (const s of report.denied) {
    lines.push(`│   ✗ ${s.name.padEnd(18)} ${s.method.padEnd(6)} ${s.path}  — ${s.denyReason ?? s.class}`);
  }
  if (report.warnings.length) {
    lines.push('│ Warnings:');
    for (const w of report.warnings) lines.push(`│   ! ${w}`);
  }
  lines.push('└────────────────────────────────────────────────────────────────');
  return lines.join('\n');
}

export function wireSkillgate(
  runtime: AgentRuntime,
  gate: Skillgate = buildGateFromModule()
): { gate: Skillgate; count: number; report: SkillgateReport } {
  const registry = toolRegistryOf(runtime);
  const count = gate.register(registry, AGENT_NAME);
  const report = gate.report();
  return { gate, count, report };
}
