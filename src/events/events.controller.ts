import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Patch, 
  Delete,
  Query, 
  UsePipes, 
  ValidationPipe, 
  UseGuards, 
  Request,
  UseInterceptors,
  UploadedFiles
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { FilterEventDto } from './dto/filter-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtOptionalAuthGuard } from '../auth/guards/jwt-optional-auth.guard';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FilesInterceptor('images', 10))
  @UsePipes(new ValidationPipe({ transform: true }))
  create(
    @UploadedFiles() images: Express.Multer.File[],
    @Body() createEventDto: CreateEventDto,
    @Request() req,
  ) {
    const userId = req.user.userId || req.user.sub;
    return this.eventsService.create(createEventDto, userId, images);
  }

  @Get()
  @UseGuards(JwtOptionalAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  findAll(@Query() filterEventDto: FilterEventDto, @Request() req) {
    return this.eventsService.findAll(filterEventDto, req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const userId = req.user?.userId || req.user?.sub;
    return this.eventsService.findOne(id, userId);
  }

  @Get(':id/similar')
  getSimilar(@Param('id') id: string) {
    return this.eventsService.getSimilar(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/upvote')
  upvote(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId || req.user.sub;
    return this.eventsService.upvote(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/upvote')
  removeUpvote(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId || req.user.sub;
    return this.eventsService.removeUpvote(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/flag')
  flag(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId || req.user.sub;
    return this.eventsService.flag(id, userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/status')
  @UsePipes(new ValidationPipe())
  updateStatus(
    @Param('id') id: string, 
    @Body() updateEventStatusDto: UpdateEventStatusDto
  ) {
    return this.eventsService.updateStatus(id, updateEventStatusDto.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/post-to-x')
  markAsPostedToX(@Param('id') id: string) {
    return this.eventsService.markAsPostedToX(id);
  }
}
