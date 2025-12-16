import { IsString, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class StockCountItemDto {
  @ApiProperty()
  @IsString()
  inventoryId: string;

  @ApiProperty()
  expectedQty: number;

  @ApiProperty({ required: false })
  @IsOptional()
  countedQty?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateStockCountDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ type: [StockCountItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockCountItemDto)
  items: StockCountItemDto[];
}

