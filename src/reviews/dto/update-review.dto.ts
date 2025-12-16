import { PartialType } from '@nestjs/mapped-types';
import { CreateReviewDto } from './create-review.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ReviewStatus } from '@prisma/client';

export class UpdateReviewDto extends PartialType(CreateReviewDto) {
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;
}

