import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  Get,
  Param,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Link } from './schemas/link.schema';
import { UsersService } from '../users/users.service';

@Controller('links')
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() createLinkDto: CreateLinkDto,
    @Request() req,
  ): Promise<Link> {
    return this.linksService.create(createLinkDto, req.user.userId);
  }

  @Get(':shortId')
  async getLinkByShortId(
    @Param('shortId') shortId: string,
    @Request() req,
  ): Promise<{ url: string }> {
    const link = await this.linksService.findByShortId(shortId);

    if (link.visibility === 'public') {
      return { url: link.url };
    }

    if (!req.user) {
      throw new UnauthorizedException(
        'You must be logged in to access this link.',
      );
    }

    const userId = req.user.userId;
    const user = await this.usersService.findById(userId);

    if (link.owner.toString() === userId) {
      return { url: link.url };
    }

    if (link.visibility === 'private') {
      throw new ForbiddenException('You do not have access to this link.');
    }

    if (link.visibility === 'request') {
      if (link.approvedUsers.includes(user.email)) {
        return { url: link.url };
      }

      if (link.approvalMode === 'domain' && user.email.endsWith(link.approvedDomain)) {
        await this.linksService.addApprovedUser(link._id.toString(), user.email);
        return { url: link.url };
      }
    }

    throw new ForbiddenException('You do not have access to this link.');
  }
}