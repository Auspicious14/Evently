import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class UpdateEventStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['pending', 'approved', 'rejected'])
  status: string;
}