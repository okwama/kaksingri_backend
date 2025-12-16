import { IsArray, ValidateNested, IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReceiveStockItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;
}

export class ReceiveStockDto {
  @ApiProperty({ type: [ReceiveStockItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveStockItemDto)
  items: ReceiveStockItemDto[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  warehouseId?: string;
}

