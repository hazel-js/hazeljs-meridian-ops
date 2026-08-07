/**
 * Controllers that Skillgate turns into skills.
 * Kept separate from AppModule so fromModule() has no circular import with AgentsModule.
 */

import { HazelModule } from '@hazeljs/core';
import { OrdersController } from './orders.controller';
import { RefundsController } from './refunds.controller';
import { TicketsController } from './tickets.controller';
import { AdminController } from './admin.controller';
import { CatalogController } from './catalog.controller';
import { HealthController } from './health.controller';

@HazelModule({
  controllers: [
    OrdersController,
    RefundsController,
    TicketsController,
    AdminController,
    CatalogController,
    HealthController,
  ],
})
export class CommerceApiModule {}
