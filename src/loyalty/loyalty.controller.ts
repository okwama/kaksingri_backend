import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';
import { CreateLoyaltyProgramDto } from './dto/create-loyalty-program.dto';
import { UpdateLoyaltyProgramDto } from './dto/update-loyalty-program.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';
import { AdjustPointsDto } from './dto/adjust-points.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Loyalty Programs')
@Controller('clients/loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  // ==================== PROGRAMS ====================

  @Post('programs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a loyalty program' })
  createProgram(@Body() createDto: CreateLoyaltyProgramDto) {
    return this.loyaltyService.createProgram({
      ...createDto,
      rules: createDto.rules || {},
    });
  }

  @Get('programs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all loyalty programs' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  findAllPrograms(@Query('active') active?: string) {
    if (active === 'true') {
      return this.loyaltyService.findActivePrograms();
    }
    return this.loyaltyService.findAllPrograms();
  }

  @Get('programs/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a loyalty program by ID' })
  findOneProgram(@Param('id') id: string) {
    return this.loyaltyService.findOneProgram(id);
  }

  @Patch('programs/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a loyalty program' })
  updateProgram(@Param('id') id: string, @Body() updateDto: UpdateLoyaltyProgramDto) {
    return this.loyaltyService.updateProgram(id, updateDto);
  }

  @Delete('programs/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a loyalty program' })
  removeProgram(@Param('id') id: string) {
    return this.loyaltyService.removeProgram(id);
  }

  // ==================== CLIENT POINTS ====================

  @Get('clients/:clientId/points')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get client points balance and history' })
  getClientPoints(@Param('clientId') clientId: string) {
    return this.loyaltyService.getClientPoints(clientId);
  }

  @Get('clients/:clientId/points/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get client points transaction history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getClientPointsHistory(
    @Param('clientId') clientId: string,
    @Query('limit') limit?: string,
  ) {
    return this.loyaltyService.getClientPointsHistory(
      clientId,
      limit ? parseInt(limit) : 50,
    );
  }

  @Post('clients/:clientId/points/redeem')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Redeem points for a client' })
  redeemPoints(@Param('clientId') clientId: string, @Body() redeemDto: RedeemPointsDto) {
    return this.loyaltyService.redeemPoints(
      clientId,
      redeemDto.points,
      redeemDto.orderId,
      redeemDto.description,
    );
  }

  @Post('clients/:clientId/points/adjust')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adjust points for a client (admin)' })
  adjustPoints(@Param('clientId') clientId: string, @Body() adjustDto: AdjustPointsDto) {
    return this.loyaltyService.adjustPoints(
      clientId,
      adjustDto.points,
      adjustDto.description,
    );
  }

  @Post('clients/:clientId/referral-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate referral code for a client' })
  generateReferralCode(@Param('clientId') clientId: string) {
    return this.loyaltyService.generateReferralCode(clientId);
  }
}

