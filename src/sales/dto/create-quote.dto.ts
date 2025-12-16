import { IsString, IsNumber, IsOptional, IsArray, IsEnum, IsDateString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { QuoteStatus } from '@prisma/client';

export class CreateQuoteItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsString()
  productName: string;

  @ApiProperty()
  @IsString()
  sku: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiProperty()
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @IsOptional()
  discount?: number;

  @ApiProperty()
  @IsNumber()
  subtotal: number;
}

export class CreateQuoteDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiProperty()
  @IsString()
  clientName: string;

  @ApiProperty()
  @IsString()
  clientEmail: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientPhone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientAddress?: string;

  @ApiProperty({ enum: QuoteStatus, default: QuoteStatus.DRAFT })
  @IsEnum(QuoteStatus)
  @IsOptional()
  status?: QuoteStatus;

  @ApiProperty()
  @IsNumber()
  subtotal: number;

  @ApiProperty()
  @IsNumber()
  tax: number;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @IsOptional()
  discount?: number;

  @ApiProperty()
  @IsNumber()
  total: number;

  @ApiProperty()
  @IsDateString()
  validUntil: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  terms?: string;

  @ApiProperty({ type: [CreateQuoteItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items: CreateQuoteItemDto[];
}

