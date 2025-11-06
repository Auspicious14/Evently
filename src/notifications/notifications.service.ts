import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MailerService } from '@nestjs-modules/mailer';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Event, EventDocument } from '../events/schemas/event.schema';


@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly mailerService: MailerService,
  ) {}

  private async createNotification(
    userId: string,
    message: string,
    type: string,
    eventId?: string,
  ): Promise<Notification> {
    const notification = new this.notificationModel({
      userId: new Types.ObjectId(userId),
      message,
      type,
      eventId: eventId ? new Types.ObjectId(eventId) : undefined,
    });
    return notification.save();
  }

  private async sendEmail(to: string, subject: string, message: string): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject,
      text: message,
    });
  }

  async sendEventCreationNotification(event: any): Promise<void> {
    const admins = await this.userModel.find({ role: 'admin' }).exec();
    for (const admin of admins) {
      const message = `A new event "${event.title}" has been created and is waiting for approval.`;
      await this.createNotification(admin._id.toString(), message, 'event_created', event._id.toString());
      await this.sendEmail(admin.email, 'New Event for Approval', message);
    }
  }

  async sendEventApprovalNotification(event: any): Promise<void> {
    const user = await this.userModel.findById(event.submitterId).exec();
    if (user) {
      const message = `Your event "${event.title}" has been approved.`;
      await this.createNotification(event.submitterId.toString(), message, 'event_approved', event._id.toString());
      await this.sendEmail(user.email, 'Event Approved', message);
    }
  }

  async sendUpvoteNotification(event: any, upvoterId: string): Promise<void> {
    const upvoter = await this.userModel.findById(upvoterId).exec();
    const eventCreator = await this.userModel.findById(event.submitterId).exec();
    if (upvoter && eventCreator) {
      const message = `${upvoter.username} upvoted your event "${event.title}".`;
      await this.createNotification(event.submitterId.toString(), message, 'event_upvoted', event._id.toString());
      await this.sendEmail(eventCreator.email, 'Your Event was Upvoted', message);
    } else {
      console.error(`Upvoter with ID ${upvoterId} or event creator not found.`);
    }
  }

  async findByUserId(userId: string): Promise<Notification[]> {
    return this.notificationModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).exec();
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    return this.notificationModel.findByIdAndUpdate(notificationId, { read: true }, { new: true }).exec();
  }
}
