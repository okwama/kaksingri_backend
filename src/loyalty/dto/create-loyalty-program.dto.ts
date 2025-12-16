import { IsString, IsOptional, IsEnum, IsBoolean, IsObject } from 'class-validator';
import { LoyaltyType } from '@prisma/client';

export class CreateLoyaltyProgramDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(LoyaltyType)
  type: LoyaltyType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  rules?: any; // Flexible rules storage
}

