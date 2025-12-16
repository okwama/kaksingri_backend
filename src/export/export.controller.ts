import { Controller, Get, Query, Res, UseGuards, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Export')
@Controller('export')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('orders/csv')
  @ApiOperation({ summary: 'Export orders to CSV' })
  async exportOrdersCSV(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const csv = await this.exportService.exportOrdersToCSV(start, end);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  }

  @Get('orders/excel')
  @ApiOperation({ summary: 'Export orders to Excel' })
  async exportOrdersExcel(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const buffer = await this.exportService.exportOrdersToExcel(start, end);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);
  }

  @Get('products/csv')
  @ApiOperation({ summary: 'Export products to CSV' })
  async exportProductsCSV(@Res() res: Response) {
    const csv = await this.exportService.exportProductsToCSV();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  }

  @Get('products/excel')
  @ApiOperation({ summary: 'Export products to Excel' })
  async exportProductsExcel(@Res() res: Response) {
    const buffer = await this.exportService.exportProductsToExcel();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);
  }

  @Get('clients/csv')
  @ApiOperation({ summary: 'Export clients to CSV' })
  async exportClientsCSV(@Res() res: Response) {
    const csv = await this.exportService.exportClientsToCSV();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="clients-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  }

  @Get('clients/excel')
  @ApiOperation({ summary: 'Export clients to Excel' })
  async exportClientsExcel(@Res() res: Response) {
    const buffer = await this.exportService.exportClientsToExcel();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="clients-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);
  }

  @Get('inventory/excel')
  @ApiOperation({ summary: 'Export inventory report to Excel' })
  async exportInventoryExcel(@Res() res: Response) {
    const buffer = await this.exportService.exportInventoryReport();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);
  }

  @Get('payments/excel')
  @ApiOperation({ summary: 'Export payment transactions to Excel' })
  async exportPaymentsExcel(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const buffer = await this.exportService.exportPaymentTransactions(start, end);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="payments-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);
  }
}

