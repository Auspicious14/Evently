import { IsEmail, IsNotEmpty } from 'class-validator';

export class ApproveRequestDto {
  @IsEmail()
  @IsNotEmpty()
  requesterEmail: string;
}