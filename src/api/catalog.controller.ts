/**
 * Public catalog — NOT tagged `agent` and no @AgentSkill.
 * Demonstrates opt-in: Skillgate excludes this in default mode.
 */

import { ApiTags, Controller, Get } from '@hazeljs/core';
import { commerceStore } from '../data/commerce.store';

@ApiTags('public')
@Controller('/api/catalog')
export class CatalogController {
  @Get('/')
  listCatalog() {
    return { products: commerceStore.listCatalog() };
  }
}
