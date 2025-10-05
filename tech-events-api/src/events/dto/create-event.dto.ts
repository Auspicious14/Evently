import { IsString, IsNotEmpty, IsDateString, IsOptional, IsUrl, IsBoolean, IsEnum } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsEnum(['AI', 'Fintech', 'Startup', 'Coding'])
  @IsNotEmpty()
  category: string;

  @IsBoolean()
  @IsOptional()
  isFree: boolean;

  @IsUrl()
  @IsOptional()
  link: string;
}