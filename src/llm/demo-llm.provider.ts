/**
 * Demo LLM for Meridian — drives support, fraud, router delegates, and Skillgate tools without an API key.
 */

import type { LLMProvider, LLMChatRequest, LLMChatResponse } from '@hazeljs/agent';

function lastUserText(messages: LLMChatRequest['messages']): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user' && typeof m.content === 'string' && !m.content.startsWith('[Tool')) {
      return m.content;
    }
  }
  return '';
}

function parseToolSummaries(messages: LLMChatRequest['messages']): Array<{ name: string; output: string }> {
  const out: Array<{ name: string; output: string }> = [];
  for (const m of messages) {
    if (typeof m.content !== 'string') continue;
    const match = m.content.match(
      /^\[Tool(?:\s+result)?:\s*([^\]]+)\]\nInput:.*?\nOutput:\s*([\s\S]*)$/m
    );
    if (match) {
      out.push({ name: match[1].trim(), output: match[2].trim() });
      continue;
    }
    const soft = m.content.match(/\[Tool(?:\s+result)?:\s*([^\]]+)\]/);
    if (soft && m.content.includes('Output:')) {
      const idx = m.content.indexOf('Output:');
      out.push({ name: soft[1].trim(), output: m.content.slice(idx + 7).trim() });
    }
  }
  return out;
}

function extractOrderId(text: string): string | undefined {
  return text.match(/ORD-\d+/i)?.[0]?.toUpperCase();
}

function extractAccountId(text: string): string | undefined {
  return text.match(/ACC-[A-Z0-9]+/i)?.[0]?.toUpperCase();
}

function resolveTool(
  tools: NonNullable<LLMChatRequest['tools']>,
  candidates: string[]
): string | undefined {
  for (const c of candidates) {
    const match = tools.find(
      (t) =>
        t.function?.name === c ||
        t.function?.name?.endsWith(`.${c}`) ||
        t.function?.name?.includes(c)
    );
    if (match?.function?.name) return match.function.name;
  }
  return undefined;
}

function called(
  summaries: Array<{ name: string }>,
  name: string
): boolean {
  return summaries.some(
    (s) => s.name === name || s.name.endsWith(`.${name}`) || s.name.includes(name)
  );
}

export class DemoLLMProvider implements LLMProvider {
  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const system = request.messages.find((m) => m.role === 'system')?.content ?? '';
    const user = lastUserText(request.messages);

    if (/critique|validate|score:/i.test(system) || /Required success score/i.test(user)) {
      return {
        content:
          'score: 96\nfeedback: PASS — answer addresses the goal with concrete tool facts.',
      };
    }
    if (/planning assistant|numbered list/i.test(system) || /^Create a concise step-by-step plan/i.test(user)) {
      return {
        content:
          '1. Identify entities (order/account)\n2. Call the right tool\n3. Answer clearly',
      };
    }

    const tools = request.tools ?? [];
    const summaries = parseToolSummaries(request.messages);
    const toolBits = summaries.map((s) => `${s.name}: ${s.output}`).join('\n');
    const orderId = extractOrderId(user) ?? 'ORD-1001';
    const accountId = extractAccountId(user) ?? 'ACC-RISK';

    const wantsFraud = /fraud|freeze|risk|ACC-/i.test(user);
    const wantsRefund = /refund|money back|return/i.test(user);
    const wantsTrack = /track|where.*package|shipping|delivery/i.test(user);
    const wantsOps =
      /list (orders|tickets|refunds)|skillgate|ops |ticket|concierge/i.test(user);

    // Router: delegate tools named after agents
    const hasDelegate =
      resolveTool(tools, ['support-desk', 'fraud-triage', 'api-concierge']) != null;
    if (hasDelegate && summaries.length === 0) {
      let target = 'support-desk';
      if (wantsFraud) target = 'fraud-triage';
      else if (wantsOps) target = 'api-concierge';
      const name = resolveTool(tools, [target])!;
      return {
        content: '',
        tool_calls: [
          {
            id: 'call_delegate',
            type: 'function',
            function: { name, arguments: JSON.stringify({ input: user }) },
          },
        ],
      };
    }
    if (hasDelegate && summaries.length > 0) {
      return { content: `Routed. Specialist result:\n\n${toolBits}` };
    }

    // Fraud tools
    if (wantsFraud && resolveTool(tools, ['getRiskSignals', 'freezeAccount'])) {
      if (!called(summaries, 'getRiskSignals') && !called(summaries, 'freezeAccount')) {
        const name = resolveTool(tools, ['getRiskSignals'])!;
        return {
          content: '',
          tool_calls: [
            {
              id: 'call_risk',
              type: 'function',
              function: { name, arguments: JSON.stringify({ accountId }) },
            },
          ],
        };
      }
      if (called(summaries, 'getRiskSignals') && !called(summaries, 'freezeAccount')) {
        const name = resolveTool(tools, ['freezeAccount']);
        if (name && /freeze|block|ACC-RISK/i.test(user)) {
          return {
            content: '',
            tool_calls: [
              {
                id: 'call_freeze',
                type: 'function',
                function: {
                  name,
                  arguments: JSON.stringify({
                    accountId,
                    reason: 'elevated fraud risk score',
                  }),
                },
              },
            ],
          };
        }
      }
      return { content: `Fraud triage complete.\n\n${toolBits}` };
    }

    // Skillgate-style tools (listOrders, getOrder, …)
    if (tools.length && resolveTool(tools, ['listOrders', 'getOrder', 'listTickets', 'createTicket'])) {
      if (summaries.length === 0) {
        const name =
          resolveTool(tools, wantsRefund ? ['createRefund', 'listRefunds'] : ['listOrders', 'getOrder', 'listTickets']) ??
          tools[0].function?.name!;
        const args =
          name.includes('getOrder') || name.includes('getShipment') || name.includes('create')
            ? { id: orderId, orderId, amountUsd: 64, reason: 'ops request', subject: 'Follow-up' }
            : {};
        return {
          content: '',
          tool_calls: [
            {
              id: 'call_skill',
              type: 'function',
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        };
      }
      return { content: `Ops concierge result:\n\n${toolBits}` };
    }

    // Support refund flow
    if (wantsRefund && tools.length) {
      if (!called(summaries, 'lookupOrder') && !called(summaries, 'processRefund')) {
        const name = resolveTool(tools, ['lookupOrder']) ?? tools[0].function?.name!;
        return {
          content: '',
          tool_calls: [
            {
              id: 'call_lookup',
              type: 'function',
              function: { name, arguments: JSON.stringify({ orderId }) },
            },
          ],
        };
      }
      if (called(summaries, 'lookupOrder') && !called(summaries, 'processRefund')) {
        const name = resolveTool(tools, ['processRefund']);
        if (name) {
          let amount = 128;
          try {
            const last = summaries[summaries.length - 1]?.output ?? '';
            const parsed = JSON.parse(last) as {
              order?: { totalUsd?: number };
              totalUsd?: number;
            };
            amount = parsed.order?.totalUsd ?? parsed.totalUsd ?? 128;
          } catch {
            /* keep */
          }
          return {
            content: '',
            tool_calls: [
              {
                id: 'call_refund',
                type: 'function',
                function: {
                  name,
                  arguments: JSON.stringify({ orderId, amount, reason: 'customer request' }),
                },
              },
            ],
          };
        }
      }
      return {
        content:
          'I looked up your order and submitted the refund for approval. ' +
          'Funds typically return in 3–5 business days.\n\n' +
          toolBits,
      };
    }

    if (summaries.length > 0) {
      return {
        content: `Here's what I found:\n\n${toolBits}\n\nLet me know if you need anything else.`,
      };
    }

    if (tools.length) {
      if (wantsTrack) {
        const name =
          resolveTool(tools, ['trackShipment', 'lookupOrder', 'getShipment']) ??
          tools[0].function?.name!;
        return {
          content: '',
          tool_calls: [
            {
              id: 'call_track',
              type: 'function',
              function: { name, arguments: JSON.stringify({ orderId, id: orderId }) },
            },
          ],
        };
      }
      const lookup =
        resolveTool(tools, ['lookupOrder', 'getOrder', 'listOrders']) ?? tools[0].function?.name!;
      return {
        content: '',
        tool_calls: [
          {
            id: 'call_lookup',
            type: 'function',
            function: { name: lookup, arguments: JSON.stringify({ orderId, id: orderId }) },
          },
        ],
      };
    }

    return {
      content:
        'I can help with Meridian orders (ORD-1001), fraud (ACC-RISK), or ops Skillgate skills.',
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getSupportedModels(): string[] {
    return ['demo-mock'];
  }
}
