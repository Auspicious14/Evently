import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterEventDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(['AI', 'Fintech', 'Startup', 'Coding'])
  @IsOptional()
  category?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;
}