import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';
import { ReturnStatus } from '@prisma/client';

export class UpdateReturnRequestDto {
  @ApiProperty({ description: 'Return status', enum: ReturnStatus, required: false })
  @IsEnum(ReturnStatus)
  @IsOptional()
  status?: ReturnStatus;

  @ApiProperty({ description: 'Refund amount', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  refundAmount?: number;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

