import { HazelModule } from '@hazeljs/core';
import { InspectorModule } from '@hazeljs/inspector';
import { AgentsModule } from './agents/agents.module';
import { CommerceApiModule } from './api/commerce-api.module';
import { GatekeeperController, ReportController } from './api/report.controller';
import { ChatModule } from './chat/chat.module';

@HazelModule({
  imports: [
    AgentsModule,
    CommerceApiModule,
    ChatModule,
    InspectorModule.forRoot({
      inspectorBasePath: '/__hazel',
      developmentOnly: false,
      enableInspector: true,
      exposeUi: true,
    }),
  ],
  controllers: [ReportController, GatekeeperController],
})
export class AppModule {}
