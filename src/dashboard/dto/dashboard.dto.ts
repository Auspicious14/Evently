export class DashboardStatsResponseDto {
  totalEventsCreated: number;
  approvedEvents: number;
  pendingEvents: number;
  rejectedEvents: number;
  totalUpvotes: number;
  totalFlags: number;
  totalViews: number;
  totalShares: number;
  currentStreak: number;
  longestStreak: number;
  favoriteCategories: string[];
  lastActivityAt: Date;
}

export class ActivityTimelineDto {
  date: Date;
  activityType: string;
  eventId?: string;
  eventTitle?: string;
  metadata?: Record<string, any>;
}

export class EventPerformanceDto {
  eventId: string;
  title: string;
  category: string;
  location: string;
  date: Date;
  upvotes: number;
  views: number;
  shares: number;
  status: string;
  createdAt: Date;
}

export class CategoryBreakdownDto {
  category: string;
  count: number;
  percentage: number;
}

export class ActivityTrendDto {
  date: string;
  count: number;
  activityType?: string;
}

export class DashboardOverviewDto {
  stats: DashboardStatsResponseDto;
  recentActivity: ActivityTimelineDto[];
  topPerformingEvents: EventPerformanceDto[];
  categoryBreakdown: CategoryBreakdownDto[];
  activityTrend: ActivityTrendDto[];
}
