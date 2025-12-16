import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { UpdateStockTransferDto } from './dto/update-stock-transfer.dto';
import { ReceiveTransferDto } from './dto/receive-transfer.dto';
import { TransferStatus, StockMovementType } from '@prisma/client';

@Injectable()
export class StockTransfersService {
  constructor(private prisma: PrismaService) {}

  async create(createTransferDto: CreateStockTransferDto, userId?: string) {
    // Validate warehouses exist
    const sourceWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: createTransferDto.sourceWarehouseId },
    });
    if (!sourceWarehouse) {
      throw new NotFoundException(`Source warehouse with ID ${createTransferDto.sourceWarehouseId} not found`);
    }

    const destWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: createTransferDto.destWarehouseId },
    });
    if (!destWarehouse) {
      throw new NotFoundException(`Destination warehouse with ID ${createTransferDto.destWarehouseId} not found`);
    }

    if (sourceWarehouse.id === destWarehouse.id) {
      throw new BadRequestException('Source and destination warehouses cannot be the same');
    }

    // Validate stock availability at source warehouse
    for (const item of createTransferDto.items) {
      const inventoryItem = await this.prisma.inventoryItem.findFirst({
        where: {
          productId: item.productId,
          warehouseId: createTransferDto.sourceWarehouseId,
        },
      });

      if (!inventoryItem) {
        throw new NotFoundException(
          `Product ${item.productId} not found in source warehouse ${sourceWarehouse.name}`,
        );
      }

      const availableQty = inventoryItem.quantity - inventoryItem.reservedQty;
      if (availableQty < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId}. Available: ${availableQty}, Requested: ${item.quantity}`,
        );
      }
    }

    // Generate transfer number
    const transferCount = await this.prisma.stockTransfer.count();
    const transferNumber = `TRF-${String(transferCount + 1).padStart(4, '0')}`;

    // Create transfer and items, and create OUT movements
    const transfer = await this.prisma.$transaction(async (prisma) => {
      const newTransfer = await prisma.stockTransfer.create({
        data: {
          transferNumber,
          sourceWarehouseId: createTransferDto.sourceWarehouseId,
          destWarehouseId: createTransferDto.destWarehouseId,
          status: TransferStatus.PENDING,
          requestedBy: userId,
          notes: createTransferDto.notes,
          items: {
            create: createTransferDto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              receivedQty: 0,
            })),
          },
        },
        include: {
          sourceWarehouse: true,
          destWarehouse: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Create OUT movements at source warehouse and decrease inventory
      for (const item of createTransferDto.items) {
        const inventoryItem = await prisma.inventoryItem.findFirst({
          where: {
            productId: item.productId,
            warehouseId: createTransferDto.sourceWarehouseId,
          },
        });

        if (inventoryItem) {
          // Decrease inventory at source
          const newQuantity = inventoryItem.quantity - item.quantity;
          await prisma.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: {
              quantity: newQuantity,
            },
          });

          // Create OUT movement
          await prisma.stockMovement.create({
            data: {
              productId: item.productId,
              inventoryId: inventoryItem.id,
              type: StockMovementType.OUT,
              quantity: -item.quantity, // Negative for OUT
              reason: `Transfer to ${destWarehouse.name} - ${transferNumber}`,
              reference: newTransfer.id,
              referenceType: 'transfer',
              transferId: newTransfer.id,
              createdBy: userId,
            },
          });
        }
      }

      return newTransfer;
    });

    return this.transformTransfer(transfer);
  }

  async findAll(warehouseId?: string, status?: TransferStatus) {
    const where: any = {};
    if (warehouseId) {
      where.OR = [
        { sourceWarehouseId: warehouseId },
        { destWarehouseId: warehouseId },
      ];
    }
    if (status) {
      where.status = status;
    }

    const transfers = await this.prisma.stockTransfer.findMany({
      where,
      include: {
        sourceWarehouse: true,
        destWarehouse: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transfers.map((transfer) => this.transformTransfer(transfer));
  }

  async findOne(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        sourceWarehouse: true,
        destWarehouse: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Stock transfer with ID ${id} not found`);
    }

    return this.transformTransfer(transfer);
  }

  async update(id: string, updateTransferDto: UpdateStockTransferDto) {
    const existingTransfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
    });

    if (!existingTransfer) {
      throw new NotFoundException(`Stock transfer with ID ${id} not found`);
    }

    if (existingTransfer.status === TransferStatus.COMPLETED) {
      throw new BadRequestException('Cannot update a completed transfer');
    }

    if (existingTransfer.status === TransferStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a cancelled transfer');
    }

    return this.prisma.stockTransfer.update({
      where: { id },
      data: {
        status: updateTransferDto.status,
        notes: updateTransferDto.notes,
      },
      include: {
        sourceWarehouse: true,
        destWarehouse: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async receiveTransfer(id: string, receiveTransferDto: ReceiveTransferDto, userId?: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        sourceWarehouse: true,
        destWarehouse: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Stock transfer with ID ${id} not found`);
    }

    if (transfer.status === TransferStatus.COMPLETED) {
      throw new BadRequestException('Transfer has already been fully received');
    }

    if (transfer.status === TransferStatus.CANCELLED) {
      throw new BadRequestException('Cannot receive stock for a cancelled transfer');
    }

    // Update received quantities and create IN movements
    let allReceived = true;
    await this.prisma.$transaction(async (prisma) => {
      for (const receiveItem of receiveTransferDto.items) {
        const transferItem = transfer.items.find((item) => item.productId === receiveItem.productId);
        if (!transferItem) {
          throw new NotFoundException(
            `Product ${receiveItem.productId} not found in transfer`,
          );
        }

        const newReceivedQty = transferItem.receivedQty + receiveItem.quantity;
        if (newReceivedQty > transferItem.quantity) {
          throw new BadRequestException(
            `Cannot receive more than transferred quantity for product ${transferItem.product.name}`,
          );
        }

        // Update received quantity
        await prisma.stockTransferItem.update({
          where: { id: transferItem.id },
          data: { receivedQty: newReceivedQty },
        });

        // Find or create inventory item at destination warehouse
        let destInventoryItem = await prisma.inventoryItem.findFirst({
          where: {
            productId: receiveItem.productId,
            warehouseId: transfer.destWarehouseId,
          },
        });

        if (!destInventoryItem) {
          // Create inventory item at destination if it doesn't exist
          const sourceInventoryItem = await prisma.inventoryItem.findFirst({
            where: {
              productId: receiveItem.productId,
              warehouseId: transfer.sourceWarehouseId,
            },
          });

          if (!sourceInventoryItem) {
            throw new NotFoundException(`Source inventory item not found for product ${receiveItem.productId}`);
          }

          destInventoryItem = await prisma.inventoryItem.create({
            data: {
              productId: receiveItem.productId,
              warehouseId: transfer.destWarehouseId,
              sku: `${sourceInventoryItem.sku}-${transfer.destWarehouseId.substring(0, 8)}`,
              quantity: 0,
              reorderPoint: sourceInventoryItem.reorderPoint,
              reorderQty: sourceInventoryItem.reorderQty,
            },
          });
        }

        // Increase inventory at destination
        const newDestQuantity = destInventoryItem.quantity + receiveItem.quantity;
        await prisma.inventoryItem.update({
          where: { id: destInventoryItem.id },
          data: {
            quantity: newDestQuantity,
          },
        });

        // Create IN movement at destination
        await prisma.stockMovement.create({
          data: {
            productId: receiveItem.productId,
            inventoryId: destInventoryItem.id,
            type: StockMovementType.IN,
            quantity: receiveItem.quantity,
            reason: `Received from transfer ${transfer.transferNumber} from ${transfer.sourceWarehouse.name}`,
            reference: transfer.id,
            referenceType: 'transfer',
            transferId: transfer.id,
            createdBy: userId,
          },
        });

        if (newReceivedQty < transferItem.quantity) {
          allReceived = false;
        }
      }

      // Update transfer status
      const newStatus = allReceived ? TransferStatus.COMPLETED : TransferStatus.IN_TRANSIT;
      const confirmedAt = allReceived ? new Date() : null;

      await prisma.stockTransfer.update({
        where: { id },
        data: {
          status: newStatus,
          confirmedBy: userId,
          confirmedAt,
        },
      });
    });

    return this.findOne(id);
  }

  async cancel(id: string, userId?: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: true,
        sourceWarehouse: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Stock transfer with ID ${id} not found`);
    }

    if (transfer.status === TransferStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed transfer');
    }

    if (transfer.status === TransferStatus.CANCELLED) {
      throw new BadRequestException('Transfer is already cancelled');
    }

    // Reverse OUT movements and restore inventory at source
    await this.prisma.$transaction(async (prisma) => {
      for (const item of transfer.items) {
        const inventoryItem = await prisma.inventoryItem.findFirst({
          where: {
            productId: item.productId,
            warehouseId: transfer.sourceWarehouseId,
          },
        });

        if (inventoryItem && item.receivedQty === 0) {
          // Only restore if nothing has been received yet
          const restoredQuantity = inventoryItem.quantity + item.quantity;
          await prisma.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: {
              quantity: restoredQuantity,
            },
          });
        }
      }

      await prisma.stockTransfer.update({
        where: { id },
        data: { status: TransferStatus.CANCELLED },
      });
    });

    return this.findOne(id);
  }

  private transformTransfer(transfer: any) {
    return {
      id: transfer.id,
      transferNumber: transfer.transferNumber,
      sourceWarehouseId: transfer.sourceWarehouseId,
      sourceWarehouseName: transfer.sourceWarehouse.name,
      destWarehouseId: transfer.destWarehouseId,
      destWarehouseName: transfer.destWarehouse.name,
      status: transfer.status.toLowerCase(),
      requestedBy: transfer.requestedBy,
      requestedAt: transfer.requestedAt?.toISOString(),
      confirmedBy: transfer.confirmedBy,
      confirmedAt: transfer.confirmedAt?.toISOString(),
      notes: transfer.notes,
      createdAt: transfer.createdAt.toISOString(),
      updatedAt: transfer.updatedAt.toISOString(),
      items: transfer.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        receivedQty: item.receivedQty,
      })),
    };
  }
}

