/**
 * Refunds — write skill opted in via @AgentSkill (x-hazel-skill) even without agent tag alone.
 * Classification: POST → write + requiresApproval by default.
 */

import { ApiTags, Body, Controller, Get, Post } from '@hazeljs/core';
import { AgentSkill } from '@hazeljs/skillgate';
import { commerceStore } from '../data/commerce.store';

@ApiTags('agent')
@Controller('/api/refunds')
export class RefundsController {
  @Get('/')
  @AgentSkill({
    name: 'listRefunds',
    description: 'List refund requests',
    readOnly: true,
    class: 'read',
  })
  listRefunds() {
    return { refunds: commerceStore.listRefunds() };
  }

  @Post('/')
  @AgentSkill({
    name: 'createRefund',
    description: 'Create a refund for an order. Requires human approval.',
    requiresApproval: true,
    class: 'write',
  })
  createRefund(@Body() body: { orderId: string; amountUsd: number; reason?: string }) {
    if (!body?.orderId) return { error: 'orderId is required' };
    if (typeof body.amountUsd !== 'number') return { error: 'amountUsd is required' };
    return commerceStore.createRefund(
      body.orderId,
      body.amountUsd,
      body.reason ?? 'customer request'
    );
  }
}
