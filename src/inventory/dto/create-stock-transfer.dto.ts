import { IsString, IsArray, IsOptional, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class StockTransferItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateStockTransferDto {
  @ApiProperty()
  @IsString()
  sourceWarehouseId: string;

  @ApiProperty()
  @IsString()
  destWarehouseId: string;

  @ApiProperty({ type: [StockTransferItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTransferItemDto)
  items: StockTransferItemDto[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

