import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getDashboardOverview(@Request() req) {
    const userId = req.user.userId || req.user.sub;
    return this.dashboardService.getDashboardOverview(userId);
  }

  @Get('stats')
  async getUserStats(@Request() req) {
    const userId = req.user.userId || req.user.sub;
    return this.dashboardService.getUserStats(userId);
  }

  @Get('activity')
  async getRecentActivity(
    @Request() req,
    @Query('limit') limit: string = '20',
  ) {
    const userId = req.user.userId || req.user.sub;
    return this.dashboardService.getRecentActivity(userId, parseInt(limit));
  }

  @Get('top-events')
  async getTopPerformingEvents(
    @Request() req,
    @Query('limit') limit: string = '5',
  ) {
    const userId = req.user.userId || req.user.sub;
    return this.dashboardService.getTopPerformingEvents(userId, parseInt(limit));
  }

  @Get('category-breakdown')
  async getCategoryBreakdown(@Request() req) {
    const userId = req.user.userId || req.user.sub;
    return this.dashboardService.getCategoryBreakdown(userId);
  }

  @Get('activity-trend')
  async getActivityTrend(
    @Request() req,
    @Query('days') days: string = '30',
  ) {
    const userId = req.user.userId || req.user.sub;
    return this.dashboardService.getActivityTrend(userId, parseInt(days));
  }
}
