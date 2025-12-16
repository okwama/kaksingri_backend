import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateReturnRequestDto {
  @ApiProperty({ description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Reason for return' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ description: 'Refund amount (optional)', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  refundAmount?: number;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

