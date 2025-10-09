import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AccessRequest,
  AccessRequestDocument,
} from './schemas/access-request.schema';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { LinksService } from '../links/links.service';
import { Link } from '../links/schemas/link.schema';
import { sendEmail } from '../utils/send-email';

interface AccessResponse {
  status: 'approved' | 'pending' | 'already_approved';
  message: string;
  data?: AccessRequest;
}

@Injectable()
export class AccessRequestsService {
  constructor(
    @InjectModel(AccessRequest.name)
    private accessRequestModel: Model<AccessRequestDocument>,
    private readonly linksService: LinksService,
  ) {}

  async create(
    link: Link,
    createAccessRequestDto: CreateAccessRequestDto,
  ): Promise<AccessResponse> {
    const { requesterEmail, requesterId } = createAccessRequestDto;

    if (link.approvedUsers.includes(requesterEmail)) {
      return {
        status: 'already_approved',
        message: 'You already have access to this link.',
      };
    }

    if (link.approvalMode === 'auto') {
      await this.linksService.addApprovedUser(
        link._id.toString(),
        requesterEmail,
      );
      return { status: 'approved', message: 'Access granted automatically.' };
    }

    if (link.approvalMode === 'domain') {
      const requesterDomain = requesterEmail.split('@')[1];
      if (requesterDomain === link.approvedDomain) {
        await this.linksService.addApprovedUser(
          link._id.toString(),
          requesterEmail,
        );
        return { status: 'approved', message: 'Access granted automatically.' };
      }
    }

    const newRequest = new this.accessRequestModel({
      linkId: link._id,
      requesterEmail,
      requesterId: requesterId
        ? new Types.ObjectId(requesterId)
        : undefined,
    });

    const savedRequest = await newRequest.save();

    if (link.approvalMode === 'manual') {
      if (link.owner && link.owner.email) {
        sendEmail(
          link.owner.email,
          `Access Request for ${link.title}`,
          `${requesterEmail} has requested access to your link: ${link.title}`,
        );
      }
    }

    return {
      status: 'pending',
      message: 'Request submitted for approval',
      data: savedRequest,
    };
  }

  async approve(
    link: Link,
    requesterEmail: string,
    ownerId: string,
  ): Promise<AccessRequest> {
    if (link.owner._id.toString() !== ownerId) {
      throw new UnauthorizedException(
        'Only the link owner can approve requests.',
      );
    }

    const request = await this.accessRequestModel.findOne({
      linkId: link._id,
      requesterEmail,
      status: 'pending',
    });

    if (!request) {
      throw new NotFoundException('Pending access request not found.');
    }

    await this.linksService.addApprovedUser(
      link._id.toString(),
      requesterEmail,
    );

    request.status = 'approved';
    return request.save();
  }

  async getRequestsForLink(
    link: Link,
    ownerId: string,
  ): Promise<AccessRequest[]> {
    if (link.owner._id.toString() !== ownerId) {
      throw new UnauthorizedException(
        'Only the link owner can view requests.',
      );
    }

    return this.accessRequestModel.find({ linkId: link._id }).exec();
  }
}