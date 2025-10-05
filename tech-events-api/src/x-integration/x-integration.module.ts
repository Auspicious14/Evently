import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { XIntegrationService } from './x-integration.service';

@Module({
  imports: [EventsModule],
  providers: [XIntegrationService],
})
export class XIntegrationModule {}