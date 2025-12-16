import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSettingDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty({ required: true })
  value: any;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  category?: string;
}

