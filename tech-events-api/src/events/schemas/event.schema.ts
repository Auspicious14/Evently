import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  location: string;

  @Prop({ type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: [0, 0] } })
  coordinates: {
    type: string;
    coordinates: number[];
  };

  @Prop({ required: true, enum: ['AI', 'Fintech', 'Startup', 'Coding'] })
  category: string;

  @Prop({ default: true })
  isFree: boolean;

  @Prop()
  link: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  submitterId: Types.ObjectId;

  @Prop({ default: 0 })
  upvotes: number;

  @Prop({ default: 0 })
  flags: number;

  @Prop({ required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  status: string;
}

export const EventSchema = SchemaFactory.createForClass(Event);

EventSchema.index({ coordinates: '2dsphere' });