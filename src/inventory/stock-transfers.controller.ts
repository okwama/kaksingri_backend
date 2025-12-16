import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StockTransfersService } from './stock-transfers.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { UpdateStockTransferDto } from './dto/update-stock-transfer.dto';
import { ReceiveTransferDto } from './dto/receive-transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransferStatus } from '@prisma/client';

@ApiTags('Inventory')
@Controller('inventory/transfers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StockTransfersController {
  constructor(private readonly stockTransfersService: StockTransfersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new stock transfer' })
  create(@Body() createTransferDto: CreateStockTransferDto, @Request() req: any) {
    return this.stockTransfersService.create(createTransferDto, req.user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all stock transfers' })
  findAll(@Query('warehouseId') warehouseId?: string, @Query('status') status?: TransferStatus) {
    return this.stockTransfersService.findAll(warehouseId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock transfer by ID' })
  findOne(@Param('id') id: string) {
    return this.stockTransfersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update stock transfer' })
  update(@Param('id') id: string, @Body() updateTransferDto: UpdateStockTransferDto) {
    return this.stockTransfersService.update(id, updateTransferDto);
  }

  @Post(':id/receive')
  @ApiOperation({ summary: 'Receive stock from transfer' })
  receiveTransfer(@Param('id') id: string, @Body() receiveTransferDto: ReceiveTransferDto, @Request() req: any) {
    return this.stockTransfersService.receiveTransfer(id, receiveTransferDto, req.user?.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel stock transfer' })
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.stockTransfersService.cancel(id, req.user?.id);
  }
}

