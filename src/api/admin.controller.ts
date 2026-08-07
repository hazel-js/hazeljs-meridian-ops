/**
 * Admin surface — tagged agent so Skillgate *sees* it, then denies as class=admin
 * unless SKILLGATE_ALLOW_ADMIN=1.
 */

import { ApiTags, Controller, Get } from '@hazeljs/core';
import { AgentSkill } from '@hazeljs/skillgate';
import { commerceStore } from '../data/commerce.store';

@ApiTags('agent')
@Controller('/api/admin')
export class AdminController {
  @Get('/users')
  @AgentSkill({
    name: 'listAdminUsers',
    description: 'List internal admin users (admin surface)',
    class: 'admin',
  })
  listAdminUsers() {
    return { users: commerceStore.listAdminUsers() };
  }
}
