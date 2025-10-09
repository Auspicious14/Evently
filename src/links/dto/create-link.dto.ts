import {
  IsString,
  IsUrl,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsMongoId,
} from 'class-validator';

export class CreateLinkDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsUrl()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  shortId: string;

  @IsMongoId()
  owner: string;

  @IsIn(['public', 'request', 'private'])
  @IsOptional()
  visibility?: string;

  @IsIn(['manual', 'auto', 'domain'])
  @IsOptional()
  approvalMode?: string;

  @IsString()
  @IsOptional()
  approvedDomain?: string;
}