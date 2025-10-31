import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event, EventSchema } from './schemas/event.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    CloudinaryModule,
    DashboardModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService], // Exporting for X-Integration module
})
export class EventsModule {}