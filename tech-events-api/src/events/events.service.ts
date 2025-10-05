import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, EventDocument } from './schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { FilterEventDto } from './dto/filter-event.dto';

@Injectable()
export class EventsService {
  constructor(@InjectModel(Event.name) private eventModel: Model<EventDocument>) {}

  async create(createEventDto: CreateEventDto, userId: string): Promise<Event> {
    const createdEvent = new this.eventModel({
      ...createEventDto,
      submitterId: new Types.ObjectId(userId),
    });
    return createdEvent.save();
  }

  async findAll(filterEventDto: FilterEventDto): Promise<Event[]> {
    const { location, category, dateFrom, dateTo, limit, skip } = filterEventDto;
    const query = this.eventModel.find();

    if (location) {
      query.where('location').equals(new RegExp(location, 'i'));
    }

    if (category) {
      query.where('category').equals(category);
    }

    if (dateFrom || dateTo) {
      query.where('date');
      if (dateFrom) {
        query.gte(new Date(dateFrom));
      }
      if (dateTo) {
        query.lte(new Date(dateTo));
      }
    }

    query.skip(skip).limit(limit);

    return query.exec();
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventModel.findById(id).exec();
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }
    return event;
  }

  async upvote(id: string): Promise<Event> {
    const event = await this.eventModel.findByIdAndUpdate(id, { $inc: { upvotes: 1 } }, { new: true });
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }
    return event;
  }

  async flag(id: string): Promise<Event> {
    const event = await this.eventModel.findByIdAndUpdate(id, { $inc: { flags: 1 } }, { new: true });
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }
    return event;
  }

  async updateStatus(id: string, status: string): Promise<Event> {
    const event = await this.eventModel.findByIdAndUpdate(id, { status }, { new: true });
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }
    return event;
  }
}