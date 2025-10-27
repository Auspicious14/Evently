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

  @IsEnum(['AI', 'Fintech', 'Startup', 'Coding', 'Hardware', 'Design', 'Marketing', 'Cybersecurity', 'Virtual'])
  @IsNotEmpty()
  category: string;

  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @IsUrl()
  @IsOptional()
  link?: string;

  // Optional fields for Twitter integration
  @IsString()
  @IsOptional()
  sourceType?: string; // 'manual' or 'x'

  @IsString()
  @IsOptional()
  sourceTweetId?: string;

  @IsEnum(['pending', 'approved', 'rejected'])
  @IsOptional()
  status?: string;

  @IsBoolean()
  @IsOptional()
  postedToX?: boolean;
}
