/**
 * Health — path matches Skillgate admin deny patterns (/health).
 * Even with agent tag, denied unless allowAdmin.
 */

import { ApiTags, Controller, Get } from '@hazeljs/core';
import { AgentSkill } from '@hazeljs/skillgate';

@ApiTags('agent')
@Controller('/health')
export class HealthController {
  @Get('/')
  @AgentSkill({
    name: 'healthCheck',
    description: 'Service health probe (internal)',
  })
  health() {
    return { ok: true, service: 'meridian-commerce' };
  }
}
