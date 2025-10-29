import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, EventDocument } from './schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { FilterEventDto } from './dto/filter-event.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    createEventDto: CreateEventDto,
    userId?: string,
    images?: Express.Multer.File[],
  ): Promise<{ success: boolean, data: Partial<Event> }> {
    // Check for duplicate tweet if from Twitter
    if (createEventDto.sourceTweetId) {
      const existing = await this.eventModel.findOne({ 
        sourceTweetId: createEventDto.sourceTweetId 
      });
      if (existing) {
        throw new BadRequestException('Event from this tweet already exists');
      }
    }

    const imageUrls = images
      ? await Promise.all(images.map(image => this.cloudinaryService.uploadImage(image)))
      : [];

    const eventData = {
      ...createEventDto,
      imageUrls,
      submitterId: userId ? new Types.ObjectId(userId) : undefined,
      source: createEventDto.sourceType || (userId ? 'manual' : 'x'),
      status: createEventDto.status || 'pending',
      type: createEventDto.type || 'online'
    };

    const createdEvent = new this.eventModel(eventData);
    const data: any = createdEvent.save();
    return { success: true, data }

  }

  async findAll(
    filterEventDto: Partial<FilterEventDto>,
  ): Promise<{ success: boolean; data: Event[] }> {
    const {
      title,
      location,
      category,
      dateFrom,
      dateTo,
      limit,
      skip,
      status,
      postedToX,
    } = filterEventDto;
    const query = this.eventModel.find();

    if (title) {
      query.where('title').regex(new RegExp(title, 'i'));
    }

    if (location) {
      query.where('location').regex(new RegExp(location, 'i'));
    }

    if (category) {
      query.where('category').equals(category);
    }

    if (dateFrom || dateTo) {
      const dateQuery: any = {};
      if (dateFrom) dateQuery.$gte = new Date(dateFrom);
      if (dateTo) dateQuery.$lte = new Date(dateTo);
      query.where('date').gte(dateQuery.$gte).lte(dateQuery.$lte);
    }

    if (status) {
      query.where('status').equals(status);
    }

    if (postedToX !== undefined) {
      query.where('postedToX').equals(postedToX);
    }

    query
      .sort({ date: 1 }) 
      .skip((skip as number) || 0)
      .limit((limit as number) || 10);

    const events = await query.exec();
    return { success: true, data: events };
  }

  async findOne(id: string): Promise<{ success: true; data: Event }> {
    const event = await this.eventModel.findById(id).exec();
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }
    return { success: true, data: event };
  }

  async getSimilar(
  id: string
): Promise<{ success: true; data: Event[] }> {
  
  const event = await this.eventModel.findById(id).lean();

  if (!event) {
    throw new NotFoundException(`Event with ID "${id}" not found`);
  }

  const query: Record<string, any> = {
    _id: { $ne: id },
    $or: [
      { category: event.category },
      { location: event.location },
      {
        date: {
          $gte: new Date(event.date.getTime() - 7 * 24 * 60 * 60 * 1000), // within 7 days before
          $lte: new Date(event.date.getTime() + 7 * 24 * 60 * 60 * 1000), // within 7 days after
        },
      },
    ],
  };

  const similarEvents = await this.eventModel
    .find(query)
    .sort({ createdAt: -1 })
    .limit(10)
    .lean()
    .exec();

  if (similarEvents.length === 0) {
    throw new NotFoundException(`No similar events found for ID "${id}"`);
  }

  return { success: true, data: similarEvents };
  }

  async upvote(id: string): Promise<{ success: true; data: Event }> {
    const event = await this.eventModel.findByIdAndUpdate(
      id,
      { $inc: { upvotes: 1 } },
      { new: true },
    );
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }
    return { success: true, data: event };
  }

  async flag(id: string): Promise<{ success: true; data: Event }> {
    const event = await this.eventModel.findByIdAndUpdate(
      id,
      { $inc: { flags: 1 } },
      { new: true },
    );
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }
    return { success: true, data: event };
  }

  async updateStatus(
    id: string,
    status: string,
  ): Promise<{ success: true; data: Event }> {
    const event = await this.eventModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }
    return { success: true, data: event };
  }

  async markAsPostedToX(id: string): Promise<{ success: true; data: Event }> {
    const event = await this.eventModel.findByIdAndUpdate(
      id,
      { 
        postedToX: true,
        postedToXAt: new Date(),
      },
      { new: true },
    );
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }
    return { success: true, data: event };
  }

  // Helper method for getting events to post to X
  async getEventsToPost(): Promise<Event[]> {
    return this.eventModel
      .find({
        status: 'approved',
        postedToX: false,
      })
      .sort({ date: 1 })
      .limit(10)
      .exec();
  }
}
