import { IsEmail, IsNotEmpty, IsOptional, IsMongoId } from 'class-validator';

export class CreateAccessRequestDto {
  @IsEmail()
  @IsNotEmpty()
  requesterEmail: string;

  @IsMongoId()
  @IsOptional()
  requesterId?: string;
}