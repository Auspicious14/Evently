import { Controller, Get, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getNotifications(@Request() req) {
    const userId = req.user.userId || req.user.sub;
    const notifications = await this.notificationsService.findByUserId(userId);
    return { success: true, data: notifications };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    const notification = await this.notificationsService.markAsRead(id);
    return { success: true, data: notification };
  }
}
