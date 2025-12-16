import { IsString, IsArray, IsOptional, IsDateString, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PurchaseOrderItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiProperty()
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ required: false, default: 0 })
  @IsNumber()
  @IsOptional()
  discount?: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsString()
  supplierId: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  expectedDate?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsNumber()
  @IsOptional()
  tax?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsNumber()
  @IsOptional()
  shipping?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [PurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}

