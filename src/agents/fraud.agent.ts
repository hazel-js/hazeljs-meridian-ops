/**
 * WHY: High-risk freezes must always HITL — never auto-freeze from the model alone.
 */

import { Service } from '@hazeljs/core';
import { Agent, Tool } from '@hazeljs/agent';
import { riskStore } from '../data/risk.store';

@Agent({
  name: 'fraud-triage',
  description: 'Fraud triage — inspect risk signals and freeze accounts with human approval.',
  systemPrompt: `You are Meridian fraud triage.
Always call getRiskSignals before freezeAccount.
Only freeze when riskScore >= 0.8 or clear fraud flags.
Never invent account IDs — use ACC-RISK or ACC-OK from the user message.
Be brief and cite the risk score.`,
  maxSteps: 6,
  temperature: 0.1,
})
@Service()
export class FraudTriageAgent {
  @Tool({
    name: 'getRiskSignals',
    description: 'Fetch risk signals for an account (e.g. ACC-RISK).',
    parameters: [
      { name: 'accountId', type: 'string', description: 'Account ID', required: true },
    ],
  })
  async getRiskSignals({ accountId }: { accountId: string }) {
    return riskStore.getSignals(accountId);
  }

  @Tool({
    name: 'freezeAccount',
    description: 'Freeze an account. Always requires human approval.',
    requiresApproval: true,
    parameters: [
      { name: 'accountId', type: 'string', description: 'Account ID', required: true },
      { name: 'reason', type: 'string', description: 'Freeze reason', required: true },
    ],
  })
  async freezeAccount({ accountId, reason }: { accountId: string; reason: string }) {
    return riskStore.freezeAccount(accountId, reason);
  }
}
