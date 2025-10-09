import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Link, LinkDocument } from './schemas/link.schema';
import { CreateLinkDto } from './dto/create-link.dto';
import { UpdateLinkDto } from './dto/update-link.dto';

@Injectable()
export class LinksService {
  constructor(@InjectModel(Link.name) private linkModel: Model<LinkDocument>) {}

  async create(
    createLinkDto: CreateLinkDto,
    ownerId: string,
  ): Promise<Link> {
    const newLink = new this.linkModel({
      ...createLinkDto,
      owner: new Types.ObjectId(ownerId),
    });
    return newLink.save();
  }

  async findByShortId(shortId: string): Promise<Link> {
    const link = await this.linkModel.findOne({ shortId }).populate('owner').exec();
    if (!link) {
      throw new NotFoundException(`Link with shortId "${shortId}" not found`);
    }
    return link;
  }

  async update(
    id: string,
    updateLinkDto: UpdateLinkDto,
  ): Promise<Link> {
    const existingLink = await this.linkModel
      .findByIdAndUpdate(id, updateLinkDto, { new: true })
      .exec();

    if (!existingLink) {
      throw new NotFoundException(`Link with ID "${id}" not found`);
    }

    return existingLink;
  }

  async addApprovedUser(linkId: string, userId: string): Promise<Link> {
    return this.linkModel.findByIdAndUpdate(
      linkId,
      { $addToSet: { approvedUsers: userId } },
      { new: true },
    );
  }
}