import {
  IsString,
  IsUrl,
  IsOptional,
  IsIn,
  IsMongoId,
} from 'class-validator';

export class UpdateLinkDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsUrl()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  shortId?: string;

  @IsMongoId()
  @IsOptional()
  owner?: string;

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