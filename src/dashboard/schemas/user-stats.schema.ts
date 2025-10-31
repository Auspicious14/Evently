import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserStatsDocument = UserStats & Document;

@Schema({ timestamps: true })
export class UserStats {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  totalEventsCreated: number;

  @Prop({ type: Number, default: 0 })
  approvedEvents: number;

  @Prop({ type: Number, default: 0 })
  pendingEvents: number;

  @Prop({ type: Number, default: 0 })
  rejectedEvents: number;

  @Prop({ type: Number, default: 0 })
  totalUpvotes: number;

  @Prop({ type: Number, default: 0 })
  totalFlags: number;

  @Prop({ type: Number, default: 0 })
  totalViews: number;

  @Prop({ type: Number, default: 0 })
  totalShares: number;

  @Prop({ type: [String], default: [] })
  favoriteCategories: string[];

  @Prop({ type: Date })
  lastActivityAt: Date;

  @Prop({ type: Number, default: 0 })
  currentStreak: number;

  @Prop({ type: Number, default: 0 })
  longestStreak: number;

  @Prop({ type: Date })
  lastStreakDate: Date;
}

export const UserStatsSchema = SchemaFactory.createForClass(UserStats);
