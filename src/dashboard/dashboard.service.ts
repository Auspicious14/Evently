import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserStats, UserStatsDocument } from './schemas/user-stats.schema';
import { UserActivity, UserActivityDocument } from './schemas/user-activity.schema';
import { Event, EventDocument } from '../events/schemas/event.schema';
import { DashboardOverviewDto, DashboardStatsResponseDto, ActivityTimelineDto, EventPerformanceDto, CategoryBreakdownDto, ActivityTrendDto } from './dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(UserStats.name) private userStatsModel: Model<UserStatsDocument>,
    @InjectModel(UserActivity.name) private userActivityModel: Model<UserActivityDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
  ) {}

  async getDashboardOverview(userId: string): Promise<DashboardOverviewDto> {
    const [stats, recentActivity, topEvents, categoryBreakdown, activityTrend] = await Promise.all([
      this.getUserStats(userId),
      this.getRecentActivity(userId, 20),
      this.getTopPerformingEvents(userId, 5),
      this.getCategoryBreakdown(userId),
      this.getActivityTrend(userId, 30),
    ]);

    return {
      stats,
      recentActivity,
      topPerformingEvents: topEvents,
      categoryBreakdown,
      activityTrend,
    };
  }

  async getUserStats(userId: string): Promise<DashboardStatsResponseDto> {
    let stats = await this.userStatsModel.findOne({ userId: new Types.ObjectId(userId) }).lean();

    if (!stats) {
      // Initialize stats if not exists
      stats = await this.initializeUserStats(userId);
    }

    return {
      totalEventsCreated: stats.totalEventsCreated,
      approvedEvents: stats.approvedEvents,
      pendingEvents: stats.pendingEvents,
      rejectedEvents: stats.rejectedEvents,
      totalUpvotes: stats.totalUpvotes,
      totalFlags: stats.totalFlags,
      totalViews: stats.totalViews,
      totalShares: stats.totalShares,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      favoriteCategories: stats.favoriteCategories,
      lastActivityAt: stats.lastActivityAt,
    };
  }

  async getRecentActivity(userId: string, limit: number = 20): Promise<ActivityTimelineDto[]> {
    const activities = await this.userActivityModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('eventId', 'title')
      .lean();

    return activities.map(activity => ({
      date: activity.createdAt,
      activityType: activity.activityType,
      eventId: activity.eventId?._id?.toString(),
      eventTitle: (activity.eventId as any)?.title,
      metadata: activity.metadata,
    }));
  }

  async getTopPerformingEvents(userId: string, limit: number = 5): Promise<EventPerformanceDto[]> {
    const events = await this.eventModel
      .find({ submitterId: new Types.ObjectId(userId) })
      .sort({ upvotes: -1, views: -1 })
      .limit(limit)
      .lean();

    return events.map(event => ({
      eventId: event._id.toString(),
      title: event.title,
      category: event.category,
      location: event.location,
      date: event.date,
      upvotes: event.upvotes,
      views: event.views || 0,
      shares: event.shares || 0,
      status: event.status,
      createdAt: event.createdAt,
    }));
  }

  async getCategoryBreakdown(userId: string): Promise<CategoryBreakdownDto[]> {
    const breakdown = await this.eventModel.aggregate([
      { $match: { submitterId: new Types.ObjectId(userId) } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const total = breakdown.reduce((sum, item) => sum + item.count, 0);

    return breakdown.map(item => ({
      category: item._id,
      count: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
  }

  async getActivityTrend(userId: string, days: number = 30): Promise<ActivityTrendDto[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await this.userActivityModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    return activities.map(item => ({
      date: item._id.date,
      count: item.count,
    }));
  }

  async trackActivity(
    userId: string,
    activityType: string,
    eventId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const activity = new this.userActivityModel({
      userId: new Types.ObjectId(userId),
      activityType,
      eventId: eventId ? new Types.ObjectId(eventId) : undefined,
      metadata,
    });

    await activity.save();

    // Update user stats
    await this.updateUserStats(userId, activityType);
  }

  async updateUserStats(userId: string, activityType: string): Promise<void> {
    const userIdObj = new Types.ObjectId(userId);
    let stats = await this.userStatsModel.findOne({ userId: userIdObj });

    if (!stats) {
      stats = await this.initializeUserStats(userId);
    }

    const updateData: any = {
      lastActivityAt: new Date(),
    };

    switch (activityType) {
      case 'event_create':
        updateData.totalEventsCreated = (stats.totalEventsCreated || 0) + 1;
        updateData.pendingEvents = (stats.pendingEvents || 0) + 1;
        break;
      case 'event_upvote':
        updateData.totalUpvotes = (stats.totalUpvotes || 0) + 1;
        break;
      case 'event_flag':
        updateData.totalFlags = (stats.totalFlags || 0) + 1;
        break;
      case 'event_view':
        updateData.totalViews = (stats.totalViews || 0) + 1;
        break;
      case 'event_share':
        updateData.totalShares = (stats.totalShares || 0) + 1;
        break;
    }

    // Update streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastStreakDate = stats.lastStreakDate ? new Date(stats.lastStreakDate) : null;

    if (lastStreakDate) {
      lastStreakDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lastStreakDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Continue streak
        updateData.currentStreak = (stats.currentStreak || 0) + 1;
        updateData.longestStreak = Math.max(updateData.currentStreak, stats.longestStreak || 0);
      } else if (diffDays > 1) {
        // Reset streak
        updateData.currentStreak = 1;
      }
    } else {
      // First activity
      updateData.currentStreak = 1;
      updateData.longestStreak = 1;
    }

    updateData.lastStreakDate = today;

    await this.userStatsModel.findOneAndUpdate(
      { userId: userIdObj },
      { $set: updateData },
      { new: true, upsert: true },
    );
  }

  async updateEventStatusInStats(userId: string, oldStatus: string, newStatus: string): Promise<void> {
    const userIdObj = new Types.ObjectId(userId);
    const updateData: any = {};

    // Decrease old status count
    if (oldStatus === 'pending') {
      updateData.pendingEvents = -1;
    } else if (oldStatus === 'approved') {
      updateData.approvedEvents = -1;
    } else if (oldStatus === 'rejected') {
      updateData.rejectedEvents = -1;
    }

    // Increase new status count
    if (newStatus === 'pending') {
      updateData.pendingEvents = (updateData.pendingEvents || 0) + 1;
    } else if (newStatus === 'approved') {
      updateData.approvedEvents = (updateData.approvedEvents || 0) + 1;
    } else if (newStatus === 'rejected') {
      updateData.rejectedEvents = (updateData.rejectedEvents || 0) + 1;
    }

    await this.userStatsModel.findOneAndUpdate(
      { userId: userIdObj },
      { $inc: updateData },
      { new: true, upsert: true },
    );
  }

  private async initializeUserStats(userId: string): Promise<any> {
    const userIdObj = new Types.ObjectId(userId);

    // Count existing events by status
    const [approved, pending, rejected, total] = await Promise.all([
      this.eventModel.countDocuments({ submitterId: userIdObj, status: 'approved' }),
      this.eventModel.countDocuments({ submitterId: userIdObj, status: 'pending' }),
      this.eventModel.countDocuments({ submitterId: userIdObj, status: 'rejected' }),
      this.eventModel.countDocuments({ submitterId: userIdObj }),
    ]);

    const stats = new this.userStatsModel({
      userId: userIdObj,
      totalEventsCreated: total,
      approvedEvents: approved,
      pendingEvents: pending,
      rejectedEvents: rejected,
      totalUpvotes: 0,
      totalFlags: 0,
      totalViews: 0,
      totalShares: 0,
      currentStreak: 0,
      longestStreak: 0,
      favoriteCategories: [],
      lastActivityAt: new Date(),
    });

    return await stats.save();
  }

  async getUpvotedEvents(userId: string): Promise<EventPerformanceDto[]> {
    const events = await this.eventModel
      .find({ upvotedBy: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();

    return events.map(event => ({
      eventId: event._id.toString(),
      title: event.title,
      category: event.category,
      location: event.location,
      date: event.date,
      upvotes: event.upvotes,
      views: event.views || 0,
      shares: event.shares || 0,
      status: event.status,
      createdAt: event.createdAt,
    }));
  }
}
