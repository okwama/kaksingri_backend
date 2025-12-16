import { IsInt, IsString, IsOptional, Min } from 'class-validator';

export class RedeemPointsDto {
  @IsInt()
  @Min(1)
  points: number;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

