import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiatePaymentDto {
  @ApiProperty()
  @IsString()
  orderId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  customerEmail?: string;
}

