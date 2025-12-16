import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getDashboardStats() {
    return this.analyticsService.getDashboardStats();
  }

  @Get('dashboard/revenue-trends')
  @ApiOperation({ summary: 'Get revenue trends' })
  getRevenueTrends(@Query('days') days?: string) {
    return this.analyticsService.getRevenueTrends(
      days ? parseInt(days) : 7,
    );
  }

  @Get('dashboard/sales-by-category')
  @ApiOperation({ summary: 'Get sales by category' })
  getSalesByCategory() {
    return this.analyticsService.getSalesByCategory();
  }

  @Get('dashboard/top-products')
  @ApiOperation({ summary: 'Get top selling products' })
  getTopProducts(@Query('limit') limit?: string) {
    return this.analyticsService.getTopProducts(
      limit ? parseInt(limit) : 5,
    );
  }

  @Get('dashboard/order-status')
  @ApiOperation({ summary: 'Get order status distribution' })
  getOrderStatusDistribution() {
    return this.analyticsService.getOrderStatusDistribution();
  }
}

