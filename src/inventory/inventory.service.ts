import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EmailService } from '../notifications/email.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { StockMovementType, StockAlertType } from '@prisma/client';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async findAll() {
    const items = await this.prisma.inventoryItem.findMany({
      include: {
        product: {
          include: { category: true },
        },
        warehouse: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return items.map((item) => {
      const availableStock = item.quantity - item.reservedQty;
      let status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued' = 'in_stock';

      if (item.quantity === 0) {
        status = 'out_of_stock';
      } else if (item.quantity <= item.reorderPoint) {
        status = 'low_stock';
      }

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        categoryName: item.product.category?.name,
        sku: item.sku,
        warehouseId: item.warehouseId,
        warehouseName: item.warehouse?.name,
        currentStock: item.quantity,
        reservedStock: item.reservedQty,
        availableStock,
        reorderLevel: item.reorderPoint,
        reorderQuantity: item.reorderQty,
        unitCost: null,
        lastRestocked: item.lastCountedAt?.toISOString(),
        status,
        location: item.location,
      };
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        product: {
          include: { category: true },
        },
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }

    return item;
  }

  async adjustStock(productId: string, adjustStockDto: AdjustStockDto, userId?: string) {
    // Find inventory items for this product
    let inventoryItem;
    
    if (adjustStockDto.inventoryId) {
      inventoryItem = await this.prisma.inventoryItem.findUnique({
        where: { id: adjustStockDto.inventoryId },
        include: { product: true },
      });
    } else {
      // Find first inventory item for this product
      inventoryItem = await this.prisma.inventoryItem.findFirst({
        where: { productId },
        include: { product: true },
      });
    }

    if (!inventoryItem) {
      throw new NotFoundException(`Inventory item for product ${productId} not found`);
    }

    const oldQuantity = inventoryItem.quantity;
    let newQuantity: number;

    switch (adjustStockDto.type) {
      case 'add':
        newQuantity = oldQuantity + adjustStockDto.quantity;
        break;
      case 'subtract':
        newQuantity = Math.max(0, oldQuantity - adjustStockDto.quantity);
        break;
      case 'set':
        newQuantity = Math.max(0, adjustStockDto.quantity);
        break;
      default:
        throw new BadRequestException('Invalid adjustment type');
    }

    const quantityChange = newQuantity - oldQuantity;

    // Update inventory item
    const updated = await this.prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { quantity: newQuantity },
      include: { product: true },
    });

    // Create stock movement record
    await this.prisma.stockMovement.create({
      data: {
        productId: inventoryItem.productId,
        inventoryId: inventoryItem.id,
        type: StockMovementType.ADJUSTMENT,
        quantity: quantityChange,
        reason: adjustStockDto.reason,
        referenceType: 'adjustment',
        createdBy: userId,
      },
    });

    // Check and create alerts if needed
    await this.checkAndCreateAlerts(inventoryItem.id, newQuantity, inventoryItem.reorderPoint);

    return updated;
  }

  async getStockMovements(limit: number = 50, productId?: string) {
    const where: any = {};
    if (productId) {
      where.productId = productId;
    }

    const movements = await this.prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        inventory: {
          select: {
            sku: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return movements.map((movement) => ({
      id: movement.id,
      productId: movement.productId,
      productName: movement.product.name,
      sku: movement.inventory.sku,
      type: movement.type.toLowerCase() as 'in' | 'out' | 'adjustment' | 'return' | 'damage' | 'transfer',
      quantity: movement.quantity,
      reason: movement.reason || '',
      reference: movement.reference,
      createdAt: movement.createdAt.toISOString(),
      createdBy: movement.createdBy,
    }));
  }

  async getAlerts(resolved: boolean = false) {
    const alerts = await this.prisma.stockAlert.findMany({
      where: { isResolved: resolved },
      include: {
        inventory: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return alerts.map((alert) => ({
      id: alert.id,
      inventoryId: alert.inventoryId,
      productId: alert.inventory.productId,
      productName: alert.inventory.product.name,
      sku: alert.inventory.sku,
      type: alert.type.toLowerCase() as 'low_stock' | 'out_of_stock' | 'overstock' | 'expiring',
      message: alert.message,
      isResolved: alert.isResolved,
      resolvedAt: alert.resolvedAt?.toISOString(),
      createdAt: alert.createdAt.toISOString(),
    }));
  }

  async resolveAlert(alertId: string) {
    const alert = await this.prisma.stockAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} not found`);
    }

    return this.prisma.stockAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });
  }

  private async checkAndCreateAlerts(
    inventoryId: string,
    quantity: number,
    reorderPoint: number,
  ) {
    const inventory = await this.prisma.inventoryItem.findUnique({
      where: { id: inventoryId },
      include: { product: true },
    });

    if (!inventory) return;

    // Check for existing unresolved alerts
    const existingAlerts = await this.prisma.stockAlert.findMany({
      where: {
        inventoryId,
        isResolved: false,
      },
    });

    // Out of stock alert
    if (quantity === 0) {
      const hasOutOfStockAlert = existingAlerts.some(
        (a) => a.type === StockAlertType.OUT_OF_STOCK,
      );
      if (!hasOutOfStockAlert) {
        await this.prisma.stockAlert.create({
          data: {
            inventoryId,
            type: StockAlertType.OUT_OF_STOCK,
            message: `${inventory.product.name} (${inventory.sku}) is out of stock`,
          },
        });
      }
    } else {
      // Resolve out of stock alerts if stock is restored
      await this.prisma.stockAlert.updateMany({
        where: {
          inventoryId,
          type: StockAlertType.OUT_OF_STOCK,
          isResolved: false,
        },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
        },
      });
    }

    // Low stock alert
    if (quantity > 0 && quantity <= reorderPoint) {
      const hasLowStockAlert = existingAlerts.some(
        (a) => a.type === StockAlertType.LOW_STOCK,
      );
      if (!hasLowStockAlert) {
        await this.prisma.stockAlert.create({
          data: {
            inventoryId,
            type: StockAlertType.LOW_STOCK,
            message: `${inventory.product.name} (${inventory.sku}) is low on stock (${quantity} remaining, reorder point: ${reorderPoint})`,
          },
        });

        // Send low stock alert email (non-blocking)
        this.sendLowStockEmail(inventory.product, quantity, reorderPoint).catch(
          (error) => {
            this.logger.error(
              `Failed to send low stock alert email for product ${inventory.product.name}: ${error.message}`,
            );
          },
        );
      }
    } else {
      // Resolve low stock alerts if stock is above reorder point
      await this.prisma.stockAlert.updateMany({
        where: {
          inventoryId,
          type: StockAlertType.LOW_STOCK,
          isResolved: false,
        },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
        },
      });
    }
  }

  /**
   * Send low stock alert email
   * This is called asynchronously and errors are logged but don't block inventory operations
   */
  private async sendLowStockEmail(
    product: any,
    currentStock: number,
    threshold: number,
  ): Promise<void> {
    try {
      const productData = {
        id: product.id,
        name: product.name,
        sku: product.sku || 'N/A',
      };

      await this.emailService.sendLowStockAlert(
        productData,
        currentStock,
        threshold,
      );
    } catch (error) {
      // Log error but don't throw - inventory operations should not fail due to email issues
      this.logger.warn(
        `Failed to send low stock email for product ${product.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async bulkRestock(productIds: string[]) {
    const results = [];

    for (const productId of productIds) {
      const inventoryItems = await this.prisma.inventoryItem.findMany({
        where: { productId },
      });

      for (const item of inventoryItems) {
        const restockQty = item.reorderQty || 20;
        const newQuantity = item.quantity + restockQty;

        await this.prisma.inventoryItem.update({
          where: { id: item.id },
          data: { quantity: newQuantity },
        });

        await this.prisma.stockMovement.create({
          data: {
            productId: item.productId,
            inventoryId: item.id,
            type: StockMovementType.IN,
            quantity: restockQty,
            reason: 'Bulk restock',
            referenceType: 'bulk_restock',
          },
        });

        await this.checkAndCreateAlerts(item.id, newQuantity, item.reorderPoint);

        results.push({ inventoryId: item.id, quantity: newQuantity });
      }
    }

    return results;
  }

  async getDashboardStats() {
    const totalProducts = await this.prisma.inventoryItem.count({
      where: { product: { isActive: true } },
    });

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      include: { product: true },
    });

    const totalStockValue = inventoryItems.reduce((sum, item) => {
      const cost = item.product.cost ? Number(item.product.cost) : 0;
      return sum + (item.quantity * cost);
    }, 0);

    // Get all inventory items and filter for low stock
    const allItems = await this.prisma.inventoryItem.findMany({
      where: {
        product: { isActive: true },
        quantity: { gt: 0 },
      },
      include: { product: true },
    });

    const lowStockItems = allItems.filter((item) => item.quantity <= item.reorderPoint);

    const outOfStockItems = await this.prisma.inventoryItem.findMany({
      where: {
        quantity: 0,
        product: { isActive: true },
      },
    });

    const recentMovements = await this.prisma.stockMovement.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });

    const pendingPOs = await this.prisma.purchaseOrder.count({
      where: {
        status: { in: ['PENDING', 'ORDERED', 'PARTIALLY_RECEIVED'] },
      },
    });

    const totalSuppliers = await this.prisma.supplier.count({
      where: { isActive: true },
    });

    return {
      totalProducts,
      totalStockValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      recentMovements,
      pendingPurchaseOrders: pendingPOs,
      totalSuppliers,
    };
  }

  async getValuationReport() {
    const items = await this.prisma.inventoryItem.findMany({
      include: {
        product: {
          include: { category: true },
        },
      },
    });

    const byCategory: { [key: string]: { quantity: number; value: number } } = {};

    items.forEach((item) => {
      const categoryName = item.product.category?.name || 'Uncategorized';
      const cost = item.product.cost ? Number(item.product.cost) : 0;
      const value = item.quantity * cost;

      if (!byCategory[categoryName]) {
        byCategory[categoryName] = { quantity: 0, value: 0 };
      }

      byCategory[categoryName].quantity += item.quantity;
      byCategory[categoryName].value += value;
    });

    return {
      totalValue: Object.values(byCategory).reduce((sum, cat) => sum + cat.value, 0),
      byCategory: Object.entries(byCategory).map(([category, data]) => ({
        category,
        quantity: data.quantity,
        value: data.value,
      })),
    };
  }

  async getAgingReport() {
    // Get products with their first stock movement date
    const items = await this.prisma.inventoryItem.findMany({
      include: {
        product: true,
        stockMovements: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    const now = new Date();
    const agingRanges = {
      '0-30': { days: 30, items: [] as any[] },
      '31-60': { days: 60, items: [] as any[] },
      '61-90': { days: 90, items: [] as any[] },
      '91+': { days: Infinity, items: [] as any[] },
    };

    items.forEach((item) => {
      const firstMovement = item.stockMovements[0];
      const ageInDays = firstMovement
        ? Math.floor((now.getTime() - new Date(firstMovement.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (ageInDays <= 30) {
        agingRanges['0-30'].items.push({
          productId: item.productId,
          productName: item.product.name,
          sku: item.sku,
          quantity: item.quantity,
          ageInDays,
        });
      } else if (ageInDays <= 60) {
        agingRanges['31-60'].items.push({
          productId: item.productId,
          productName: item.product.name,
          sku: item.sku,
          quantity: item.quantity,
          ageInDays,
        });
      } else if (ageInDays <= 90) {
        agingRanges['61-90'].items.push({
          productId: item.productId,
          productName: item.product.name,
          sku: item.sku,
          quantity: item.quantity,
          ageInDays,
        });
      } else {
        agingRanges['91+'].items.push({
          productId: item.productId,
          productName: item.product.name,
          sku: item.sku,
          quantity: item.quantity,
          ageInDays,
        });
      }
    });

    return Object.entries(agingRanges).map(([range, data]) => ({
      range,
      count: data.items.length,
      totalQuantity: data.items.reduce((sum, item) => sum + item.quantity, 0),
      items: data.items,
    }));
  }

  async getTurnoverReport() {
    // Get products with sales data from order items
    const products = await this.prisma.product.findMany({
      include: {
        inventoryItems: true,
        orderItems: {
          include: {
            order: true,
          },
        },
      },
    });

    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    return products.map((product) => {
      const totalStock = product.inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
      const sales30Days = product.orderItems
        .filter((item) => new Date(item.order.createdAt) >= last30Days)
        .reduce((sum, item) => sum + item.quantity, 0);
      const sales90Days = product.orderItems
        .filter((item) => new Date(item.order.createdAt) >= last90Days)
        .reduce((sum, item) => sum + item.quantity, 0);

      const turnover30 = totalStock > 0 ? sales30Days / totalStock : 0;
      const turnover90 = totalStock > 0 ? sales90Days / totalStock : 0;

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        currentStock: totalStock,
        sales30Days,
        sales90Days,
        turnover30,
        turnover90,
        velocity: totalStock > 0 ? (sales30Days / 30) : 0, // units per day
      };
    }).sort((a, b) => b.turnover30 - a.turnover30);
  }

  async getSettings() {
    // Get settings from database or return defaults
    try {
      const settings = await this.prisma.setting.findMany({
        where: { category: 'inventory' },
      });

      if (settings.length === 0) {
        return {
          valuationMethod: 'fifo',
          autoReorder: false,
          barcodeEnabled: false,
          warehouses: [{ name: 'Main Warehouse', address: 'Nairobi, Kenya', isDefault: true }],
        };
      }

      const settingsObj: any = {};
      settings.forEach((setting) => {
        const key = setting.key.replace('inventory_', '');
        settingsObj[key] = setting.value;
      });

      return {
        valuationMethod: settingsObj.valuationMethod || 'fifo',
        autoReorder: settingsObj.autoReorder || false,
        barcodeEnabled: settingsObj.barcodeEnabled || false,
        warehouses: settingsObj.warehouses || [
          { name: 'Main Warehouse', address: 'Nairobi, Kenya', isDefault: true },
        ],
      };
    } catch (error) {
      return {
        valuationMethod: 'fifo',
        autoReorder: false,
        barcodeEnabled: false,
        warehouses: [{ name: 'Main Warehouse', address: 'Nairobi, Kenya', isDefault: true }],
      };
    }
  }

  async updateSettings(settingsData: any) {
    const settingsToUpdate = [
      { key: 'inventory_valuationMethod', value: settingsData.valuationMethod },
      { key: 'inventory_autoReorder', value: settingsData.autoReorder },
      { key: 'inventory_barcodeEnabled', value: settingsData.barcodeEnabled },
      { key: 'inventory_warehouses', value: settingsData.warehouses },
    ];

    for (const setting of settingsToUpdate) {
      await this.prisma.setting.upsert({
        where: { key: setting.key },
        update: { value: setting.value, category: 'inventory' },
        create: { key: setting.key, value: setting.value, category: 'inventory' },
      });
    }

    return this.getSettings();
  }

  async getWarehouses() {
    return this.prisma.warehouse.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createWarehouse(createWarehouseDto: any) {
    // If setting as default, unset other defaults
    if (createWarehouseDto.isDefault) {
      await this.prisma.warehouse.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.warehouse.create({
      data: createWarehouseDto,
    });
  }

  async updateWarehouse(id: string, updateWarehouseDto: any) {
    // If setting as default, unset other defaults
    if (updateWarehouseDto.isDefault) {
      await this.prisma.warehouse.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: updateWarehouseDto,
    });
  }

  async deleteWarehouse(id: string) {
    // Check if warehouse has inventory items
    const hasInventory = await this.prisma.inventoryItem.count({
      where: { warehouseId: id },
    });

    if (hasInventory > 0) {
      throw new BadRequestException(
        'Cannot delete warehouse with inventory items. Please transfer or remove all inventory first.',
      );
    }

    // Check if warehouse has transfers
    const hasTransfers = await this.prisma.stockTransfer.count({
      where: {
        OR: [{ sourceWarehouseId: id }, { destWarehouseId: id }],
      },
    });

    if (hasTransfers > 0) {
      throw new BadRequestException(
        'Cannot delete warehouse with transfer history. Please deactivate it instead.',
      );
    }

    return this.prisma.warehouse.delete({
      where: { id },
    });
  }
}
