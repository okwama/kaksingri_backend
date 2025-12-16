import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { SuppliersService } from './suppliers.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { StocktakingService } from './stocktaking.service';
import { StockTransfersService } from './stock-transfers.service';
import { StockTransfersController } from './stock-transfers.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [InventoryController, StockTransfersController],
  providers: [InventoryService, SuppliersService, PurchaseOrdersService, StocktakingService, StockTransfersService],
  exports: [InventoryService, SuppliersService, PurchaseOrdersService, StocktakingService, StockTransfersService],
})
export class InventoryModule {}

