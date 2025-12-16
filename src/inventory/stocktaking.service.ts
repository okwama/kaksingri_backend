import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateStockCountDto } from './dto/create-stock-count.dto';
import { UpdateStockCountDto } from './dto/update-stock-count.dto';
import { StockCountStatus, StockMovementType } from '@prisma/client';

@Injectable()
export class StocktakingService {
  constructor(private prisma: PrismaService) {}

  async create(createStockCountDto: CreateStockCountDto, userId?: string) {
    const countNumber = `SC-${String(await this.prisma.stockCount.count() + 1).padStart(4, '0')}`;

    const stockCount = await this.prisma.stockCount.create({
      data: {
        countNumber,
        location: createStockCountDto.location,
        status: StockCountStatus.DRAFT,
        createdBy: userId,
        items: {
          create: createStockCountDto.items.map((item) => ({
            inventoryId: item.inventoryId,
            expectedQty: item.expectedQty,
            countedQty: item.countedQty || item.expectedQty,
            variance: (item.countedQty || item.expectedQty) - item.expectedQty,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: {
          include: {
            inventory: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    return this.transformStockCount(stockCount);
  }

  async findAll() {
    const counts = await this.prisma.stockCount.findMany({
      include: {
        items: {
          include: {
            inventory: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return counts.map((count) => this.transformStockCount(count));
  }

  async findOne(id: string) {
    const count = await this.prisma.stockCount.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            inventory: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!count) {
      throw new NotFoundException(`Stock count with ID ${id} not found`);
    }

    return this.transformStockCount(count);
  }

  async update(id: string, updateStockCountDto: UpdateStockCountDto) {
    const count = await this.prisma.stockCount.findUnique({
      where: { id },
    });

    if (!count) {
      throw new NotFoundException(`Stock count with ID ${id} not found`);
    }

    const updateData: any = {};

    if (updateStockCountDto.status) {
      updateData.status = updateStockCountDto.status;

      if (updateStockCountDto.status === StockCountStatus.IN_PROGRESS && !count.startedAt) {
        updateData.startedAt = new Date();
      }

      if (updateStockCountDto.status === StockCountStatus.COMPLETED) {
        updateData.completedAt = new Date();
        // Apply adjustments for discrepancies
        await this.applyStockCountAdjustments(id);
      }
    }

    if (updateStockCountDto.location !== undefined) {
      updateData.location = updateStockCountDto.location;
    }

    return this.prisma.stockCount.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            inventory: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
  }

  async updateCountItem(countId: string, itemId: string, countedQty: number, notes?: string) {
    const count = await this.prisma.stockCount.findUnique({
      where: { id: countId },
      include: { items: { include: { inventory: true } } },
    });

    if (!count) {
      throw new NotFoundException(`Stock count with ID ${countId} not found`);
    }

    if (count.status === StockCountStatus.COMPLETED) {
      throw new BadRequestException('Cannot update items in a completed stock count');
    }

    const item = count.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Stock count item with ID ${itemId} not found`);
    }

    const variance = countedQty - item.expectedQty;

    await this.prisma.stockCountItem.update({
      where: { id: itemId },
      data: {
        countedQty,
        variance,
        notes,
      },
    });

    // Update status to IN_PROGRESS if still DRAFT
    if (count.status === StockCountStatus.DRAFT) {
      await this.prisma.stockCount.update({
        where: { id: countId },
        data: {
          status: StockCountStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });
    }

    return this.findOne(countId);
  }

  async complete(id: string) {
    const count = await this.prisma.stockCount.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!count) {
      throw new NotFoundException(`Stock count with ID ${id} not found`);
    }

    if (count.status === StockCountStatus.COMPLETED) {
      throw new BadRequestException('Stock count is already completed');
    }

    // Apply adjustments
    await this.applyStockCountAdjustments(id);

    return this.prisma.stockCount.update({
      where: { id },
      data: {
        status: StockCountStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: {
        items: {
          include: {
            inventory: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
  }

  private async applyStockCountAdjustments(countId: string) {
    const count = await this.prisma.stockCount.findUnique({
      where: { id: countId },
      include: {
        items: {
          include: {
            inventory: true,
          },
        },
      },
    });

    if (!count) return;

    for (const item of count.items) {
      if (item.variance !== 0) {
        const newQuantity = item.countedQty;
        const oldQuantity = item.inventory.quantity;
        const adjustment = newQuantity - oldQuantity;

        // Update inventory
        await this.prisma.inventoryItem.update({
          where: { id: item.inventoryId },
          data: { quantity: newQuantity },
        });

        // Create stock movement
        await this.prisma.stockMovement.create({
          data: {
            productId: item.inventory.productId,
            inventoryId: item.inventoryId,
            type: StockMovementType.ADJUSTMENT,
            quantity: adjustment,
            reason: `Stock count adjustment from ${count.countNumber}`,
            reference: countId,
            referenceType: 'stock_count',
          },
        });
      }
    }
  }

  async remove(id: string) {
    const count = await this.prisma.stockCount.findUnique({
      where: { id },
    });

    if (!count) {
      throw new NotFoundException(`Stock count with ID ${id} not found`);
    }

    if (count.status === StockCountStatus.COMPLETED) {
      throw new BadRequestException('Cannot delete a completed stock count');
    }

    return this.prisma.stockCount.update({
      where: { id },
      data: { status: StockCountStatus.CANCELLED },
    });
  }

  private transformStockCount(count: any) {
    const itemsCounted = count.items.length;
    const totalItems = count.items.length;
    const discrepancies = count.items.filter((item: any) => item.variance !== 0).length;

    return {
      id: count.id,
      countNumber: count.countNumber,
      location: count.location,
      status: count.status.toLowerCase().replace('_', '_') as 'draft' | 'in_progress' | 'completed' | 'cancelled',
      itemsCounted,
      totalItems,
      discrepancies,
      startedAt: count.startedAt?.toISOString(),
      completedAt: count.completedAt?.toISOString(),
      createdBy: count.createdBy,
      items: count.items.map((item: any) => ({
        id: item.id,
        inventoryId: item.inventoryId,
        productName: item.inventory.product.name,
        sku: item.inventory.sku,
        expectedQty: item.expectedQty,
        countedQty: item.countedQty,
        variance: item.variance,
        notes: item.notes,
      })),
    };
  }
}

