/**
 * Tickets list — read skill. Create lives under OrdersController (POST /orders/:id/tickets).
 */

import { ApiTags, Controller, Get, Query } from '@hazeljs/core';
import { AgentSkill } from '@hazeljs/skillgate';
import { commerceStore } from '../data/commerce.store';

@ApiTags('agent')
@Controller('/api/tickets')
export class TicketsController {
  @Get('/')
  @AgentSkill({
    name: 'listTickets',
    description: 'List support tickets, optionally filtered by orderId',
    readOnly: true,
    class: 'read',
  })
  listTickets(@Query('orderId') orderId?: string) {
    return { tickets: commerceStore.listTickets(orderId) };
  }
}
