import { Controller, Get, Post, Param, Body, Query, UseGuards, Request, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { SuppliersService } from './suppliers.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { StocktakingService } from './stocktaking.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ReceiveStockDto } from './dto/receive-stock.dto';
import { CreateStockCountDto } from './dto/create-stock-count.dto';
import { UpdateStockCountDto } from './dto/update-stock-count.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly suppliersService: SuppliersService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly stocktakingService: StocktakingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all inventory items' })
  findAll() {
    return this.inventoryService.findAll();
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get stock movement transactions' })
  getTransactions(
    @Query('limit') limit?: string,
    @Query('productId') productId?: string,
  ) {
    return this.inventoryService.getStockMovements(
      limit ? parseInt(limit) : 50,
      productId,
    );
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get stock alerts' })
  getAlerts(@Query('resolved') resolved?: string) {
    return this.inventoryService.getAlerts(resolved === 'true');
  }

  @Post(':productId/adjust')
  @ApiOperation({ summary: 'Adjust stock for a product' })
  adjustStock(
    @Param('productId') productId: string,
    @Body() adjustStockDto: AdjustStockDto,
    @Request() req: any,
  ) {
    return this.inventoryService.adjustStock(
      productId,
      adjustStockDto,
      req.user?.id,
    );
  }

  @Post('bulk-restock')
  @ApiOperation({ summary: 'Bulk restock products' })
  bulkRestock(@Body() body: { productIds: string[] }) {
    return this.inventoryService.bulkRestock(body.productIds);
  }

  @Patch('alerts/:id/resolve')
  @ApiOperation({ summary: 'Resolve a stock alert' })
  resolveAlert(@Param('id') id: string) {
    return this.inventoryService.resolveAlert(id);
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get inventory dashboard statistics' })
  getDashboardStats() {
    return this.inventoryService.getDashboardStats();
  }

  // Suppliers endpoints
  @Post('suppliers')
  @ApiOperation({ summary: 'Create a new supplier' })
  createSupplier(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'Get all suppliers' })
  findAllSuppliers() {
    return this.suppliersService.findAll();
  }

  @Get('suppliers/:id')
  @ApiOperation({ summary: 'Get supplier by ID' })
  findOneSupplier(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Patch('suppliers/:id')
  @ApiOperation({ summary: 'Update supplier' })
  updateSupplier(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete('suppliers/:id')
  @ApiOperation({ summary: 'Delete supplier' })
  removeSupplier(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }

  // Purchase Orders endpoints
  @Post('purchase-orders')
  @ApiOperation({ summary: 'Create a new purchase order' })
  createPurchaseOrder(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto, @Request() req: any) {
    return this.purchaseOrdersService.create(createPurchaseOrderDto, req.user?.id);
  }

  @Get('purchase-orders')
  @ApiOperation({ summary: 'Get all purchase orders' })
  findAllPurchaseOrders() {
    return this.purchaseOrdersService.findAll();
  }

  @Get('purchase-orders/:id')
  @ApiOperation({ summary: 'Get purchase order by ID' })
  findOnePurchaseOrder(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch('purchase-orders/:id')
  @ApiOperation({ summary: 'Update purchase order' })
  updatePurchaseOrder(@Param('id') id: string, @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    return this.purchaseOrdersService.update(id, updatePurchaseOrderDto);
  }

  @Post('purchase-orders/:id/receive')
  @ApiOperation({ summary: 'Receive stock from purchase order' })
  receiveStock(@Param('id') id: string, @Body() receiveStockDto: ReceiveStockDto, @Request() req: any) {
    return this.purchaseOrdersService.receiveStock(id, receiveStockDto, req.user?.id);
  }

  @Delete('purchase-orders/:id')
  @ApiOperation({ summary: 'Cancel purchase order' })
  removePurchaseOrder(@Param('id') id: string) {
    return this.purchaseOrdersService.remove(id);
  }

  // Stocktaking endpoints
  @Post('stocktaking')
  @ApiOperation({ summary: 'Create a new stock count' })
  createStockCount(@Body() createStockCountDto: CreateStockCountDto, @Request() req: any) {
    return this.stocktakingService.create(createStockCountDto, req.user?.id);
  }

  @Get('stocktaking')
  @ApiOperation({ summary: 'Get all stock counts' })
  findAllStockCounts() {
    return this.stocktakingService.findAll();
  }

  @Get('stocktaking/:id')
  @ApiOperation({ summary: 'Get stock count by ID' })
  findOneStockCount(@Param('id') id: string) {
    return this.stocktakingService.findOne(id);
  }

  @Patch('stocktaking/:id')
  @ApiOperation({ summary: 'Update stock count' })
  updateStockCount(@Param('id') id: string, @Body() updateStockCountDto: UpdateStockCountDto) {
    return this.stocktakingService.update(id, updateStockCountDto);
  }

  @Post('stocktaking/:id/complete')
  @ApiOperation({ summary: 'Complete stock count and apply adjustments' })
  completeStockCount(@Param('id') id: string) {
    return this.stocktakingService.complete(id);
  }

  @Patch('stocktaking/:countId/items/:itemId')
  @ApiOperation({ summary: 'Update stock count item' })
  updateStockCountItem(
    @Param('countId') countId: string,
    @Param('itemId') itemId: string,
    @Body() body: { countedQty: number; notes?: string },
  ) {
    return this.stocktakingService.updateCountItem(countId, itemId, body.countedQty, body.notes);
  }

  @Delete('stocktaking/:id')
  @ApiOperation({ summary: 'Cancel stock count' })
  removeStockCount(@Param('id') id: string) {
    return this.stocktakingService.remove(id);
  }

  // Reports endpoints
  @Get('reports/valuation')
  @ApiOperation({ summary: 'Get stock valuation report' })
  getValuationReport() {
    return this.inventoryService.getValuationReport();
  }

  @Get('reports/aging')
  @ApiOperation({ summary: 'Get stock aging report' })
  getAgingReport() {
    return this.inventoryService.getAgingReport();
  }

  @Get('reports/turnover')
  @ApiOperation({ summary: 'Get turnover analysis report' })
  getTurnoverReport() {
    return this.inventoryService.getTurnoverReport();
  }

  // Settings endpoints
  @Get('settings')
  @ApiOperation({ summary: 'Get inventory settings' })
  getSettings() {
    return this.inventoryService.getSettings();
  }

  @Post('settings')
  @ApiOperation({ summary: 'Update inventory settings' })
  updateSettings(@Body() settings: any) {
    return this.inventoryService.updateSettings(settings);
  }

  // Warehouse endpoints
  @Get('warehouses')
  @ApiOperation({ summary: 'Get all warehouses' })
  getWarehouses() {
    return this.inventoryService.getWarehouses();
  }

  @Post('warehouses')
  @ApiOperation({ summary: 'Create a new warehouse' })
  createWarehouse(@Body() createWarehouseDto: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(createWarehouseDto);
  }

  @Patch('warehouses/:id')
  @ApiOperation({ summary: 'Update warehouse' })
  updateWarehouse(@Param('id') id: string, @Body() updateWarehouseDto: UpdateWarehouseDto) {
    return this.inventoryService.updateWarehouse(id, updateWarehouseDto);
  }

  @Delete('warehouses/:id')
  @ApiOperation({ summary: 'Delete warehouse' })
  deleteWarehouse(@Param('id') id: string) {
    return this.inventoryService.deleteWarehouse(id);
  }
}

