import { PartialType } from '@nestjs/swagger';
import { CreatePurchaseOrderDto } from './create-purchase-order.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { POStatus } from '@prisma/client';

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {
  @ApiProperty({ required: false, enum: POStatus })
  @IsEnum(POStatus)
  @IsOptional()
  status?: POStatus;
}

