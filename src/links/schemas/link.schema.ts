import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type LinkDocument = Link & Document;

@Schema({ timestamps: true })
export class Link {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true, unique: true })
  shortId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  owner: User;

  @Prop({
    required: true,
    enum: ['public', 'request', 'private'],
    default: 'private',
  })
  visibility: string;

  @Prop({
    required: true,
    enum: ['manual', 'auto', 'domain'],
    default: 'manual',
  })
  approvalMode: string;

  @Prop()
  approvedDomain?: string;

  @Prop({ type: [{ type: String }] })
  approvedUsers: string[];

  @Prop({ default: 0 })
  clickCount: number;
}

export const LinkSchema = SchemaFactory.createForClass(Link);