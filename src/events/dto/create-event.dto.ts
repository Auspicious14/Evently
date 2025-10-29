// dto/create-event.dto.ts - COMPLETE
import { IsString, IsNotEmpty, IsDateString, IsOptional, IsUrl, IsBoolean, IsEnum } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsEnum(['AI', 'Fintech', 'Startup', 'Coding', 'Hardware', 'Design', 'Marketing', 'Cybersecurity', 'Virtual', 'Physical'])
  @IsNotEmpty()
  category: string;

  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @IsUrl()
  @IsOptional()
  link?: string;

  // Twitter integration fields
  @IsString()
  @IsOptional()
  sourceType?: string;

  @IsString()
  @IsOptional()
  sourceTweetId?: string;

  @IsEnum(['pending', 'approved', 'rejected'])
  @IsOptional()
  status?: string;

  @IsEnum(['online', 'in-person'])
  @IsOptional()
  eventType?: string;

  @IsBoolean()
  @IsOptional()
  postedToX?: boolean;
}
