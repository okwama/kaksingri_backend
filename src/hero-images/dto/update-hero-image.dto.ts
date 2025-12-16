import { PartialType } from '@nestjs/mapped-types';
import { CreateHeroImageDto } from './create-hero-image.dto';

export class UpdateHeroImageDto extends PartialType(CreateHeroImageDto) {}

