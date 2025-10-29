import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Patch, 
  Query, 
  UsePipes, 
  ValidationPipe, 
  UseGuards, 
  Request 
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { FilterEventDto } from './dto/filter-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  create(@Body() createEventDto: CreateEventDto, @Request() req) {
    const userId = req.user.userId || req.user.sub;
    return this.eventsService.create(createEventDto, userId);
  }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  findAll(@Query() filterEventDto: FilterEventDto) {
    return this.eventsService.findAll(filterEventDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Get(':id/similar')
  async getSimilar(@Param('id') id: string) {
    const event = await this.eventsService.findOne(id);
    const similar = await this.eventsService.getSimilarEvents(
      id, 
      event.data.category
    );
    return { success: true, data: similar };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/upvote')
  upvote(@Param('id') id: string) {
    return this.eventsService.upvote(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/flag')
  flag(@Param('id') id: string) {
    return this.eventsService.flag(id);
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
