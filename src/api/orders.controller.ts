/**
 * Orders API — opted into Skillgate via @ApiTags('agent') + @AgentSkill.
 *
 * Reads → readOnly skills. DELETE → destructive (denied unless allowDestructive).
 */

import { ApiTags, Body, Controller, Delete, Get, Param, Post } from '@hazeljs/core';
import { AgentSkill } from '@hazeljs/skillgate';
import { commerceStore } from '../data/commerce.store';

@ApiTags('agent')
@Controller('/api/orders')
export class OrdersController {
  @Get('/')
  @AgentSkill({
    name: 'listOrders',
    description: 'List recent Meridian Commerce orders',
    readOnly: true,
    class: 'read',
  })
  listOrders() {
    return { orders: commerceStore.listOrders() };
  }

  @Get('/:id')
  @AgentSkill({
    name: 'getOrder',
    description: 'Fetch an order by id (e.g. ORD-1001). Returns status, items, totals.',
    readOnly: true,
    class: 'read',
  })
  getOrder(@Param('id') id: string) {
    const order = commerceStore.getOrder(id);
    if (!order) return { found: false, error: `No order ${id}` };
    return { found: true, order };
  }

  @Get('/:id/shipment')
  @AgentSkill({
    name: 'getShipment',
    description: 'Get shipment tracking details for an order',
    readOnly: true,
    class: 'read',
  })
  getShipment(@Param('id') id: string) {
    return commerceStore.getShipment(id);
  }

  @Post('/:id/tickets')
  @AgentSkill({
    name: 'createTicket',
    description: 'Open a support ticket for an order. Requires human approval.',
    requiresApproval: true,
    class: 'write',
  })
  createTicket(
    @Param('id') id: string,
    @Body() body: { subject: string; body?: string }
  ) {
    if (!body?.subject?.trim()) return { error: 'subject is required' };
    return commerceStore.createTicket(id, body.subject, body.body);
  }

  /** Destructive — Skillgate denies DELETE by default. */
  @Delete('/:id')
  @AgentSkill({
    name: 'deleteOrder',
    description: 'Permanently delete an order (destructive)',
    class: 'destructive',
    requiresApproval: true,
  })
  deleteOrder(@Param('id') id: string) {
    return commerceStore.deleteOrder(id);
  }
}
