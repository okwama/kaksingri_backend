import { IsString, IsOptional, IsInt, Min, Max, IsEmail } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

