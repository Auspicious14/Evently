import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from '../events/schemas/event.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AdminStatsOverviewResponseDto, AdminEventManagementDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getStatsOverview(): Promise<AdminStatsOverviewResponseDto> {
    const [
      totalEvents,
      pendingEvents,
      approvedEvents,
      rejectedEvents,
      totalUsers,
      totalViews,
      totalUpvotes,
      totalFlags,
    ] = await Promise.all([
      this.eventModel.countDocuments(),
      this.eventModel.countDocuments({ status: 'pending' }),
      this.eventModel.countDocuments({ status: 'approved' }),
      this.eventModel.countDocuments({ status: 'rejected' }),
      this.userModel.countDocuments(),
      this.eventModel.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
      this.eventModel.aggregate([{ $group: { _id: null, total: { $sum: '$upvotes' } } }]),
      this.eventModel.aggregate([{ $group: { _id: null, total: { $sum: '$flags' } } }]),
    ]);

    return {
      totalEvents,
      pendingEvents,
      approvedEvents,
      rejectedEvents,
      totalUsers,
      totalEventViews: totalViews[0]?.total || 0,
      totalUpvotes: totalUpvotes[0]?.total || 0,
      totalFlags: totalFlags[0]?.total || 0,
    };
  }

  async getEventsForManagement(): Promise<AdminEventManagementDto[]> {
    const events = await this.eventModel
      .find()
      .populate('submitterId', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();

    return events.map((event) => ({
      eventId: event._id.toString(),
      title: event.title,
      submitter: {
        id: (event.submitterId as any)?._id?.toString() || 'system',
        name: (event.submitterId as any)?.name || 'system',
        avatar: (event.submitterId as any)?.avatar,
      },
      date: event.date,
      category: event.category,
      status: event.status,
      upvotes: event.upvotes,
      views: event.views || 0,
      flags: event.flags || 0,
      createdAt: event.createdAt,
    }));
  }
}
