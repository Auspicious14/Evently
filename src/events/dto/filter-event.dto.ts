import { IsString, IsOptional, IsDateString, IsEnum, IsBoolean } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Transform } from 'class-transformer';

export class FilterEventDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  title?: string
  
  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(['AI', 'Fintech', 'Startup', 'Coding', 'Hardware', 'Design', 'Marketing', 'Cybersecurity', 'Virtual', 'Physical'])
  @IsOptional()
  category?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsEnum(['pending', 'approved', 'rejected'])
  @IsOptional()
  status?: string;

  @IsEnum(['online', 'in-person'])
  @IsOptional()
  eventType?: string;

  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (typeof value === 'boolean') return value;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  postedToX?: boolean;

  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (typeof value === 'boolean') return value;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isFree?: boolean;
}

