export class AdminStatsOverviewResponseDto {
  totalEvents: number;
  pendingEvents: number;
  approvedEvents: number;
  rejectedEvents: number;
  totalUsers: number;
  totalEventViews: number;
  totalUpvotes: number;
  totalFlags: number;
}

export class AdminEventManagementDto {
  eventId: string;
  title: string;
  submitter: {
    id: string;
    name: string;
    avatar?: string;
  };
  date: Date;
  category: string;
  status: string;
  upvotes: number;
  views: number;
  flags: number;
  createdAt: Date;
}
