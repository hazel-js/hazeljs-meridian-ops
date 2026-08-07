/**
 * Risk signals + account freeze for fraud-triage agent.
 */

export interface RiskSignals {
  accountId: string;
  email: string;
  riskScore: number;
  flags: string[];
  recentOrders: string[];
}

const ACCOUNTS: Record<string, RiskSignals> = {
  'ACC-RISK': {
    accountId: 'ACC-RISK',
    email: 'suspicious@example.com',
    riskScore: 0.92,
    flags: ['velocity', 'new_device', 'high_refund_rate'],
    recentOrders: ['ORD-1002', 'ORD-1003'],
  },
  'ACC-OK': {
    accountId: 'ACC-OK',
    email: 'ava@example.com',
    riskScore: 0.12,
    flags: [],
    recentOrders: ['ORD-1001'],
  },
};

const frozen = new Set<string>();

export const riskStore = {
  getSignals(accountId: string): { found: true; signals: RiskSignals } | { found: false; error: string } {
    const row = ACCOUNTS[accountId.toUpperCase()];
    if (!row) return { found: false, error: `No account ${accountId}` };
    return { found: true, signals: { ...row } };
  },

  freezeAccount(
    accountId: string,
    reason: string
  ): { success: boolean; freezeId?: string; error?: string; reason?: string } {
    const key = accountId.toUpperCase();
    if (!ACCOUNTS[key]) return { success: false, error: `No account ${accountId}` };
    if (frozen.has(key)) return { success: false, error: 'Already frozen' };
    frozen.add(key);
    return {
      success: true,
      freezeId: `FRZ-${key}-${Date.now().toString(36)}`,
      reason,
    };
  },

  isFrozen(accountId: string): boolean {
    return frozen.has(accountId.toUpperCase());
  },

  listFrozen(): string[] {
    return [...frozen];
  },
};
