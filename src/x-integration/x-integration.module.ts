import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsModule } from '../events/events.module';
import { XIntegrationService } from './x-integration.service';
import { TweetProcessorService } from './services/tweet-processor.service';
import { TwitterSearchService } from './services/twitter-search.service';
import { TwitterPostingService } from './services/twitter-posting.service';

@Module({
  imports: [ConfigModule, EventsModule],
  providers: [
    XIntegrationService,
    TweetProcessorService,
    TwitterSearchService,
    TwitterPostingService,
  ],
})
export class XIntegrationModule {}