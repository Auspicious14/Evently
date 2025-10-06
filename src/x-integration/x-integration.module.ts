import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsModule } from '../events/events.module';
import { XIntegrationService } from './x-integration.service';

@Module({
  imports: [ConfigModule, EventsModule],
  providers: [XIntegrationService],
})
export class XIntegrationModule {}