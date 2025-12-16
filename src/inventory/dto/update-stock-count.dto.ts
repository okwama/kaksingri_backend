import { PartialType } from '@nestjs/swagger';
import { CreateStockCountDto } from './create-stock-count.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StockCountStatus } from '@prisma/client';

export class UpdateStockCountDto extends PartialType(CreateStockCountDto) {
  @ApiProperty({ required: false, enum: StockCountStatus })
  @IsEnum(StockCountStatus)
  @IsOptional()
  status?: StockCountStatus;
}

