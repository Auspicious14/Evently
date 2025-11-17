import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, EventDocument } from './schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { FilterEventDto } from './dto/filter-event.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly dashboardService: DashboardService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    createEventDto: CreateEventDto,
    userId?: string,
    images?: Express.Multer.File[],
  ): Promise<{ success: boolean; data: Partial<Event> }> {
    if (createEventDto.sourceTweetId) {
      const existing = await this.eventModel.findOne({
        sourceTweetId: createEventDto.sourceTweetId,
      });
      if (existing) {
        throw new BadRequestException('Event from this tweet already exists');
      }
    }

    const uploadedImageUrls = images
      ? await Promise.all(
          images.map((image) => this.cloudinaryService.uploadImage(image)),
        )
      : [];

    const coordinates = this.geocodeLocation(createEventDto.location);

    const eventData = {
      ...createEventDto,
      imageUrls: [...(createEventDto.imageUrls || []), ...uploadedImageUrls],
      submitterId: userId ? new Types.ObjectId(userId) : undefined,
      source: createEventDto.sourceType || (userId ? 'manual' : 'x'),
      status: createEventDto.status || 'pending',
      eventType: createEventDto.eventType || 'online',
      isFree: createEventDto.isFree,
      coordinates: coordinates
        ? {
            type: 'Point',
            coordinates: coordinates,
          }
        : undefined,
    };

    const createdEvent = new this.eventModel(eventData);
    const data: any = await createdEvent.save();

    // Track activity
    if (userId) {
      await this.dashboardService.trackActivity(
        userId,
        'event_create',
        data._id.toString(),
        {
          category: data.category,
          location: data.location,
        },
      );
    }

    await this.notificationsService.sendEventCreationNotification(data);

    return { success: true, data: data.toObject() };
  }

  /**
   * Bulk create events (optimized for Twitter/X integration)
   * Handles duplicates, validation, and batch operations efficiently
   */
  async createBulk(
    createEventDtos: CreateEventDto[],
    userId?: string,
  ): Promise<{
    success: boolean;
    data: Event[];
    stats: {
      total: number;
      created: number;
      duplicates: number;
      failed: number;
    };
  }> {
    this.logger.log(
      `Starting bulk create for ${createEventDtos.length} events`,
    );

    const stats = {
      total: createEventDtos.length,
      created: 0,
      duplicates: 0,
      failed: 0,
    };

    const createdEvents: Event[] = [];
    const eventsToInsert: any[] = [];

    // Step 1: Check for duplicates in batch
    const tweetIds = createEventDtos
      .filter((dto) => dto.sourceTweetId)
      .map((dto) => dto.sourceTweetId);

    const existingEvents =
      tweetIds.length > 0
        ? await this.eventModel
            .find({ sourceTweetId: { $in: tweetIds } })
            .select('sourceTweetId')
            .lean()
            .exec()
        : [];

    const existingTweetIds = new Set(
      existingEvents.map((e: any) => e.sourceTweetId),
    );

    // Step 2: Process each event
    for (const createEventDto of createEventDtos) {
      try {
        // Check for duplicates
        if (
          createEventDto.sourceTweetId &&
          existingTweetIds.has(createEventDto.sourceTweetId)
        ) {
          stats.duplicates++;
          this.logger.debug(
            `Duplicate event skipped: ${createEventDto.sourceTweetId}`,
          );
          continue;
        }

        // Geocode location
        const coordinates = this.geocodeLocation(createEventDto.location);

        // Prepare event data
        const eventData = {
          ...createEventDto,
          imageUrls: createEventDto.imageUrls || [],
          submitterId: userId ? new Types.ObjectId(userId) : undefined,
          source: createEventDto.sourceType || 'x',
          status: createEventDto.status || 'pending',
          eventType: createEventDto.eventType || 'online',
          isFree: createEventDto.isFree ?? false,
          coordinates: coordinates
            ? {
                type: 'Point',
                coordinates: coordinates,
              }
            : undefined,
          views: 0,
          upvotes: 0,
          flags: 0,
          upvotedBy: [],
          postedToX: createEventDto.postedToX ?? false,
          postedToXAt: createEventDto.postedToX ? new Date() : undefined,
        };

        eventsToInsert.push(eventData);
      } catch (error) {
        stats.failed++;
        this.logger.warn(
          `Failed to prepare event: ${createEventDto.title}`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    // Step 3: Bulk insert if we have events
    if (eventsToInsert.length > 0) {
      try {
        const insertedEvents = await this.eventModel.insertMany(
          eventsToInsert,
          {
            ordered: false, // Continue on error
            lean: true,
          },
        );

        createdEvents.push(...insertedEvents);
        stats.created = insertedEvents.length;

        this.logger.log(`✅ Bulk created ${stats.created} events successfully`);

        // Step 4: Track activities in background (non-blocking)
        if (userId) {
          this.trackBulkActivities(userId, insertedEvents).catch((error) =>
            this.logger.error('Failed to track bulk activities:', error),
          );
        }

        // Step 5: Send notifications in background (non-blocking)
        this.sendBulkNotifications(insertedEvents).catch((error) =>
          this.logger.error('Failed to send bulk notifications:', error),
        );
      } catch (error: any) {
        // Handle partial success in insertMany
        if (error.writeErrors) {
          stats.created = error.insertedDocs?.length || 0;
          stats.failed += error.writeErrors.length;
          createdEvents.push(...(error.insertedDocs || []));

          this.logger.warn(
            `Partial bulk insert: ${stats.created} created, ${stats.failed} failed`,
          );
        } else {
          this.logger.error('Bulk insert failed completely:', error.message);
          throw error;
        }
      }
    }

    this.logger.log(
      `Bulk create completed: ${stats.created} created, ${stats.duplicates} duplicates, ${stats.failed} failed`,
    );

    return {
      success: true,
      data: createdEvents,
      stats,
    };
  }

  /**
   * Track activities for bulk created events (non-blocking)
   */
  private async trackBulkActivities(
    userId: string,
    events: any[],
  ): Promise<void> {
    const activities = events.map((event) => ({
      userId,
      action: 'event_create',
      eventId: event._id.toString(),
      metadata: {
        category: event.category,
        location: event.location,
        source: 'bulk_import',
      },
    }));

    // Track in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      await Promise.all(
        batch.map((activity) =>
          this.dashboardService.trackActivity(
            activity.userId,
            activity.action as any,
            activity.eventId,
            activity.metadata,
          ),
        ),
      ).catch((error) =>
        this.logger.warn('Failed to track activity batch:', error),
      );
    }
  }

  /**
   * Send notifications for bulk created events (non-blocking)
   */
  private async sendBulkNotifications(events: any[]): Promise<void> {
    // Send notifications in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      await Promise.all(
        batch.map((event) =>
          this.notificationsService
            .sendEventCreationNotification(event)
            .catch((error) =>
              this.logger.warn(
                `Failed to send notification for event ${event._id}:`,
                error,
              ),
            ),
        ),
      );

      // Small delay between batches
      if (i + batchSize < events.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Check if events already exist by tweet IDs
   */
  async checkDuplicates(
    tweetIds: string[],
  ): Promise<{ exists: string[]; new: string[] }> {
    if (tweetIds.length === 0) {
      return { exists: [], new: tweetIds };
    }

    const existingEvents = await this.eventModel
      .find({ sourceTweetId: { $in: tweetIds } })
      .select('sourceTweetId')
      .lean()
      .exec();

    const existingTweetIds = new Set(
      existingEvents.map((e: any) => e.sourceTweetId),
    );

    return {
      exists: Array.from(existingTweetIds),
      new: tweetIds.filter((id) => !existingTweetIds.has(id)),
    };
  }

  async findAll(
    filterEventDto: Partial<FilterEventDto>,
    user?: any,
  ): Promise<{ success: boolean; data: Event[]; total: number }> {
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
      eventType,
      isFree,
      eventStatus,
    } = filterEventDto;

    const queryConditions: any = {};

    if (title) {
      queryConditions.title = { $regex: new RegExp(title, 'i') };
    }

    if (location) {
      queryConditions.location = { $regex: new RegExp(location, 'i') };
    }

    if (category) {
      queryConditions.category = category;
    }

    if (eventType) {
      queryConditions.eventType = eventType;
    }

    if (isFree !== undefined) {
      queryConditions.isFree = isFree;
    }

    if (eventStatus) {
      queryConditions.eventStatus = eventStatus;
    }

    if (dateFrom || dateTo) {
      queryConditions.date = {};
      if (dateFrom) queryConditions.date.$gte = new Date(dateFrom);
      if (dateTo) queryConditions.date.$lte = new Date(dateTo);
    }

    if (postedToX !== undefined) {
      queryConditions.postedToX = postedToX;
    }

    const isAdmin = user && user.role === 'admin';

    if (isAdmin) {
      if (status) {
        queryConditions.status = status;
      }
    } else if (user) {
      const userId = user.userId || user.sub;
      queryConditions.$or = [
        { status: 'approved' },
        { status: 'pending', submitterId: new Types.ObjectId(userId) },
      ];
      if (status) {
        if (status === 'approved') {
          delete queryConditions.$or;
          queryConditions.status = 'approved';
        } else if (status === 'pending') {
          delete queryConditions.$or;
          queryConditions.status = 'pending';
          queryConditions.submitterId = new Types.ObjectId(userId);
        } else {
          queryConditions._id = null;
        }
      }
    } else {
      queryConditions.status = 'approved';
      if (status && status !== 'approved') {
        queryConditions._id = null;
      }
    }

    const findQuery = this.eventModel
      .find(queryConditions)
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit);

    const countQuery = this.eventModel.countDocuments(queryConditions);

    const [events, total] = await Promise.all([
      findQuery.exec(),
      countQuery.exec(),
    ]);

    return { success: true, data: events, total };
  }

  async findOne(
    id: string,
    userId?: string,
  ): Promise<{ success: true; data: Event }> {
    const event = await this.eventModel
      .findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true })
      .exec();

    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }

    // Track view activity
    if (userId) {
      await this.dashboardService.trackActivity(userId, 'event_view', id);
    }

    // Check if user has already upvoted
    const eventData: any = event.toObject();
    if (userId) {
      eventData.hasUpvoted = event.upvotedBy.some(
        (uid) => uid.toString() === userId,
      );
    }

    return { success: true, data: eventData };
  }

  async getSimilar(id: string): Promise<{ success: true; data: Event[] }> {
    const event = await this.eventModel.findById(id).lean();

    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }

    const query: Record<string, any> = {
      _id: { $ne: id },
      status: 'approved', // Only show approved similar events
      $or: [
        { category: event.category },
        { location: event.location },
        {
          date: {
            $gte: new Date(event.date.getTime() - 7 * 24 * 60 * 60 * 1000),
            $lte: new Date(event.date.getTime() + 7 * 24 * 60 * 60 * 1000),
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

  async upvote(
    id: string,
    userId: string,
  ): Promise<{ success: true; data: Event; message?: string }> {
    const event = await this.eventModel.findById(id);

    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }

    const userObjectId = new Types.ObjectId(userId);

    const hasUpvoted = event.upvotedBy.some((uid) => uid.toString() === userId);

    if (hasUpvoted) {
      throw new BadRequestException('You have already upvoted this event');
    }

    event.upvotes += 1;
    event.upvotedBy.push(userObjectId);
    await event.save();

    // Track activity
    await this.dashboardService.trackActivity(userId, 'event_upvote', id);

    await this.notificationsService.sendUpvoteNotification(event, userId);

    return {
      success: true,
      data: event,
      message: 'Event upvoted successfully',
    };
  }

  async removeUpvote(
    id: string,
    userId: string,
  ): Promise<{ success: true; data: Event }> {
    const event = await this.eventModel.findById(id);

    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }

    const hasUpvoted = event.upvotedBy.some((uid) => uid.toString() === userId);

    if (!hasUpvoted) {
      throw new BadRequestException('You have not upvoted this event');
    }

    // Remove upvote
    event.upvotes = Math.max(0, event.upvotes - 1);
    event.upvotedBy = event.upvotedBy.filter(
      (uid) => uid.toString() !== userId,
    );
    await event.save();

    return { success: true, data: event };
  }

  async flag(
    id: string,
    userId: string,
  ): Promise<{ success: true; data: Event }> {
    const event = await this.eventModel.findByIdAndUpdate(
      id,
      { $inc: { flags: 1 } },
      { new: true },
    );
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }

    // Track activity
    await this.dashboardService.trackActivity(userId, 'event_flag', id);

    return { success: true, data: event };
  }

  async updateStatus(
    id: string,
    status: string,
  ): Promise<{ success: true; data: Event }> {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }

    const oldStatus = event.status;
    event.status = status;
    await event.save();

    // Update stats
    if (event.submitterId) {
      await this.dashboardService.updateEventStatusInStats(
        event.submitterId.toString(),
        oldStatus,
        status,
      );
    }
    if (status === 'approved') {
      await this.notificationsService.sendEventApprovalNotification(event);
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

  /**
   * Get events ready to be posted to X/Twitter
   */
  async getEventsToPost(limit: number = 10): Promise<Event[]> {
    return this.eventModel
      .find({
        status: 'approved',
        postedToX: false,
        date: { $gte: new Date() }, // Only future events
      })
      .sort({ date: 1, upvotes: -1 }) // Prioritize sooner events and popular ones
      .limit(limit)
      .exec();
  }

  /**
   * Get upcoming events (events with eventStatus = 'upcoming')
   */
  async getUpcomingEvents(
    limit: number = 20,
    skip: number = 0,
    user?: any,
  ): Promise<{ success: boolean; data: Event[]; total: number }> {
    return this.findAll(
      {
        eventStatus: 'upcoming',
        limit,
        skip,
      },
      user,
    );
  }

  /**
   * Get past events (events with eventStatus = 'past')
   */
  async getPastEvents(
    limit: number = 20,
    skip: number = 0,
    user?: any,
  ): Promise<{ success: boolean; data: Event[]; total: number }> {
    return this.findAll(
      {
        eventStatus: 'past',
        limit,
        skip,
      },
      user,
    );
  }

  /**
   * Get ongoing events (events with eventStatus = 'ongoing')
   */
  async getOngoingEvents(
    limit: number = 20,
    skip: number = 0,
    user?: any,
  ): Promise<{ success: boolean; data: Event[]; total: number }> {
    return this.findAll(
      {
        eventStatus: 'ongoing',
        limit,
        skip,
      },
      user,
    );
  }

  /**
   * Get bulk statistics for imported events
   */
  async getBulkImportStats(
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    const matchQuery: any = { source: 'x' };

    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) matchQuery.createdAt.$gte = dateFrom;
      if (dateTo) matchQuery.createdAt.$lte = dateTo;
    }

    const [total, byStatus, byCategory, bySource] = await Promise.all([
      this.eventModel.countDocuments(matchQuery),
      this.eventModel.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.eventModel.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      this.eventModel.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s: any) => [s._id, s.count])),
      byCategory: Object.fromEntries(
        byCategory.map((c: any) => [c._id, c.count]),
      ),
      bySource: Object.fromEntries(bySource.map((s: any) => [s._id, s.count])),
    };
  }

  private geocodeLocation(location: string): [number, number] | null {
    const cityCoords: Record<string, [number, number]> = {
      Lagos: [3.3792, 6.5244],
      Abuja: [7.3986, 9.0765],
      'Port Harcourt': [7.0498, 4.8156],
      Kano: [8.5919, 12.0022],
      Ibadan: [3.947, 7.3775],
      Kaduna: [7.4165, 10.5105],
      'Benin City': [5.6037, 6.335],
      Enugu: [7.5105, 6.5244],
      Jos: [8.8583, 9.8965],
      Ilorin: [4.55, 8.5],
      Aba: [7.3667, 5.1167],
      Onitsha: [6.7833, 6.15],
      Warri: [5.75, 5.5167],
      Calabar: [8.3417, 4.9517],
      Uyo: [7.9333, 5.0333],
      Owerri: [7.0333, 5.4833],
      Abeokuta: [3.35, 7.15],
      Akure: [5.195, 7.25],
      Maiduguri: [13.09, 11.85],
      Zaria: [7.7, 11.05],
      Sokoto: [5.25, 13.05],
      Bauchi: [9.8333, 10.3167],
      AdoEkiti: [7.6167, 5.2167],
      Asaba: [6.8167, 6.7167],
      Awka: [7.0667, 6.2167],
      BirninKebbi: [12.4539, 4.1986],
      Damaturu: [11.747, 11.966],
      Dutse: [11.759, 9.345],
      Gombe: [10.2833, 11.1667],
      Gusau: [12.15, 6.6667],
      Jalingo: [8.9, 11.3667],
      Lafia: [8.4833, 8.5167],
      Lokoja: [7.8024, 6.7383],
      Makurdi: [7.7411, 8.5301],
      Minna: [9.6167, 6.55],
      Osogbo: [7.7667, 4.5667],
      Oyo: [7.85, 3.9333],
      Suleja: [9.2, 7.1667],
      Umuahia: [5.5333, 7.4833],
      Yenagoa: [4.9243, 6.2649],
      Yola: [9.2167, 12.4833],
    };

    const locationLower = location.toLowerCase();
    for (const [city, coords] of Object.entries(cityCoords)) {
      if (locationLower.includes(city.toLowerCase())) {
        return coords;
      }
    }

    return null;
  }
}
