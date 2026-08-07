import { HazelModule } from '@hazeljs/core';
import { AgentsModule } from '../agents/agents.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@HazelModule({
  imports: [AgentsModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
