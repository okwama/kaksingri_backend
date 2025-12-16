import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdjustStockDto {
  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiProperty({ enum: ['add', 'subtract', 'set'] })
  @IsEnum(['add', 'subtract', 'set'])
  type: 'add' | 'subtract' | 'set';

  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  inventoryId?: string;
}

