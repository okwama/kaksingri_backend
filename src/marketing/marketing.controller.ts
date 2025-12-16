import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketingService } from './marketing.service';

@ApiTags('Marketing')
@Controller('marketing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get marketing statistics' })
  getStats() {
    return this.marketingService.getStats();
  }
}

