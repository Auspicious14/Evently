import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit = 20;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  skip = 0;
}