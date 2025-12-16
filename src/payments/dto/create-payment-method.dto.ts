import { IsString, IsEnum, IsBoolean, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethodType } from '@prisma/client';

export class CreatePaymentMethodDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: PaymentMethodType })
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiProperty({ description: 'Payment credentials (API keys, secrets, etc.)' })
  @IsObject()
  credentials: Record<string, any>;

  @ApiProperty({ required: false, description: 'Additional configuration' })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

