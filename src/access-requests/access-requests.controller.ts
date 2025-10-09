import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  Param,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessRequestsService } from './access-requests.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtOptionalAuthGuard } from '../auth/jwt-optional.guard';
import { LinksService } from '../links/links.service';

@Controller('links/:shortId')
export class AccessRequestsController {
  constructor(
    private readonly accessRequestsService: AccessRequestsService,
    private readonly linksService: LinksService,
  ) {}

  @UseGuards(JwtOptionalAuthGuard)
  @Post('request-access')
  async requestAccess(
    @Param('shortId') shortId: string,
    @Body() createAccessRequestDto: CreateAccessRequestDto,
    @Request() req,
  ) {
    const link = await this.linksService.findByShortId(shortId);

    if (req.user) {
      createAccessRequestDto.requesterId = req.user.userId;
      // If the user is authenticated, we can derive their email.
      // Assuming the user object has an email property.
      // This part might need adjustment based on the actual user object structure.
      // createAccessRequestDto.requesterEmail = req.user.email;
    } else if (!createAccessRequestDto.requesterEmail) {
      throw new UnauthorizedException(
        'Email is required for unauthenticated users.',
      );
    }

    return this.accessRequestsService.create(link, createAccessRequestDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('approve')
  async approveRequest(
    @Param('shortId') shortId: string,
    @Body() approveRequestDto: ApproveRequestDto,
    @Request() req,
  ) {
    const link = await this.linksService.findByShortId(shortId);
    return this.accessRequestsService.approve(
      link,
      approveRequestDto.requesterEmail,
      req.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('requests')
  async getRequests(
    @Param('shortId') shortId: string,
    @Request() req,
  ) {
    const link = await this.linksService.findByShortId(shortId);
    return this.accessRequestsService.getRequestsForLink(
      link,
      req.user.userId,
    );
  }
}