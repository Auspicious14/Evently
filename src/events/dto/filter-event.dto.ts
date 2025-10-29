import { IsString, IsOptional, IsDateString, IsEnum, IsBoolean } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

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

  @IsBoolean()
  @IsOptional()
  postedToX?: boolean;
}

