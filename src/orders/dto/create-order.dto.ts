import { IsString, IsNumber, IsOptional, IsArray, IsEnum, ValidateNested, IsBoolean, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderStatus, PaymentStatus } from '@prisma/client';

export class CreateOrderItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

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
}

export class CreateOrderDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiProperty({ enum: OrderStatus, default: OrderStatus.PENDING })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiProperty({ enum: PaymentStatus, default: PaymentStatus.PENDING })
  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @ApiProperty()
  @IsNumber()
  subtotal: number;

  @ApiProperty()
  @IsNumber()
  tax: number;

  @ApiProperty()
  @IsNumber()
  shipping: number;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @IsOptional()
  discount?: number;

  @ApiProperty()
  @IsNumber()
  total: number;

  @ApiProperty({ required: false })
  @IsOptional()
  shippingAddress?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  billingAddress?: any;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  // Customer info for account creation (optional)
  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  createAccount?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  password?: string;
}

