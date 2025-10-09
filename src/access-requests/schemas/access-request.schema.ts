import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AccessRequestDocument = AccessRequest & Document;

@Schema({ timestamps: true })
export class AccessRequest {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Link', required: true })
  linkId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  requesterEmail: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  requesterId?: MongooseSchema.Types.ObjectId;

  @Prop({
    required: true,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: string;
}

export const AccessRequestSchema = SchemaFactory.createForClass(AccessRequest);