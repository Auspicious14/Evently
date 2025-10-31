import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { UserStats, UserStatsSchema } from './schemas/user-stats.schema';
import { UserActivity, UserActivitySchema } from './schemas/user-activity.schema';
import { Event, EventSchema } from '../events/schemas/event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserStats.name, schema: UserStatsSchema },
      { name: UserActivity.name, schema: UserActivitySchema },
      { name: Event.name, schema: EventSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
