import { IsInt, IsString, IsOptional } from 'class-validator';

export class AdjustPointsDto {
  @IsInt()
  points: number; // Can be positive or negative

  @IsOptional()
  @IsString()
  description?: string;
}

