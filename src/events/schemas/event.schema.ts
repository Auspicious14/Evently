import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  location: string;

  @Prop({ 
    required: true,
    enum: ['AI', 'Fintech', 'Startup', 'Coding', 'Hardware', 'Design', 'Marketing', 'Cybersecurity', 'Virtual']
  })
  category: string;

  @Prop({ default: false })
  isFree: boolean;

  @Prop()
  link?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  submitterId?: Types.ObjectId;

  @Prop({ default: 'manual', enum: ['manual', 'x'] })
  source: string;

  @Prop()
  sourceTweetId?: string;

  @Prop({ default: 'pending', enum: ['pending', 'approved', 'rejected'] })
  status: string;

  @Prop({ default: 0 })
  upvotes: number;

  @Prop({ default: 0 })
  flags: number;

  @Prop({ default: false })
  postedToX: boolean;

  @Prop()
  postedToXAt?: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);

// Add indexes for better query performance
EventSchema.index({ date: 1, status: 1 });
EventSchema.index({ category: 1, status: 1 });
EventSchema.index({ status: 1, postedToX: 1 });
EventSchema.index({ sourceTweetId: 1 }, { unique: true, sparse: true });
