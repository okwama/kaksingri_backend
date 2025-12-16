import { PartialType } from '@nestjs/swagger';
import { CreateStockTransferDto } from './create-stock-transfer.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { TransferStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateStockTransferDto extends PartialType(CreateStockTransferDto) {
  @ApiProperty({ required: false, enum: TransferStatus })
  @IsEnum(TransferStatus)
  @IsOptional()
  status?: TransferStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  notes?: string;
}

