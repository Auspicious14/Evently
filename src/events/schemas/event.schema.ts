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
    enum: ['AI', 'Fintech', 'Startup', 'Coding', 'Hardware', 'Design', 'Marketing', 'Cybersecurity', 'Virtual', 'Physical']
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

  @Prop()
  twitterUrl?: string;

  @Prop({ default: 'pending', enum: ['pending', 'approved', 'rejected'] })
  status: string;

  @Prop({ default: 'online', enum: ['online', 'in-person'] })
  eventType: string;

  @Prop({ default: 0 })
  upvotes: number;

  @Prop({ default: 0 })
  flags: number;

  @Prop({ default: false })
  postedToX: boolean;

  @Prop()
  postedToXAt?: Date;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  upvotedBy: Types.ObjectId[];

  // Add coordinates for map
  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  })
  coordinates?: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };

  // Add view count
  @Prop({ default: 0 })
  views?: number;
  
   @Prop({default: 0})
  shares?: number

  // Add going count (RSVP)
  @Prop({ default: 0 })
  goingCount?: number;

  @Prop({ type: [String] })
  imageUrls?: string[];

  // Event status based on date (upcoming/past)
  @Prop({ 
    default: 'upcoming',
    enum: ['upcoming', 'past', 'ongoing']
  })
  eventStatus?: string;

  // Catchy label for past events
  @Prop()
  pastEventLabel?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);

// Pre-save hook to update event status and past event label
EventSchema.pre('save', function(next) {
  const now = new Date();
  const eventDate = this.date;
  
  if (eventDate < now) {
    this.eventStatus = 'past';
    // Generate catchy labels for past events
    const catchyLabels = [
      'Epic Memories Made',
      'Legendary Moments',
      'Unforgettable Experience',
      'Historic Gathering',
      'Epic Concluded',
      'Memorable Event',
      'Successfully Completed',
      'Amazingly Done',
      'Fantastic Finish',
      'Incredible Journey'
    ];
    this.pastEventLabel = catchyLabels[Math.floor(Math.random() * catchyLabels.length)];
  } else if (eventDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) { // Within 24 hours
    this.eventStatus = 'ongoing';
    this.pastEventLabel = undefined;
  } else {
    this.eventStatus = 'upcoming';
    this.pastEventLabel = undefined;
  }
  
  next();
});

// Add indexes for better query performance
EventSchema.index({ date: 1, status: 1 });
EventSchema.index({ category: 1, status: 1 });
EventSchema.index({ status: 1, postedToX: 1 });
EventSchema.index({ eventStatus: 1 });
EventSchema.index({ eventStatus: 1, date: 1 });
EventSchema.index({ sourceTweetId: 1 }, { unique: true, sparse: true });
EventSchema.index({ coordinates: '2dsphere' }); 
EventSchema.index({ upvotedBy: 1 })
