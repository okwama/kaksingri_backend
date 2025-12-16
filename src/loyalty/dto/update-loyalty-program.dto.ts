import { PartialType } from '@nestjs/mapped-types';
import { CreateLoyaltyProgramDto } from './create-loyalty-program.dto';

export class UpdateLoyaltyProgramDto extends PartialType(CreateLoyaltyProgramDto) {}

