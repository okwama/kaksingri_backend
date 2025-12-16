import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ReceiveStockDto } from './dto/receive-stock.dto';
import { POStatus, StockMovementType } from '@prisma/client';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto, userId?: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: createPurchaseOrderDto.supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${createPurchaseOrderDto.supplierId} not found`);
    }

    // Generate PO number
    const poCount = await this.prisma.purchaseOrder.count();
    const poNumber = `PO-${String(poCount + 1).padStart(4, '0')}`;

    // Calculate totals
    const subtotal = createPurchaseOrderDto.items.reduce(
      (sum, item) => sum + (item.quantity * item.unitPrice) - (item.discount || 0),
      0,
    );
    const tax = createPurchaseOrderDto.tax || 0;
    const shipping = createPurchaseOrderDto.shipping || 0;
    const total = subtotal + tax + shipping;

    const po = await this.prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: createPurchaseOrderDto.supplierId,
        expectedDate: createPurchaseOrderDto.expectedDate
          ? new Date(createPurchaseOrderDto.expectedDate)
          : null,
        subtotal,
        tax,
        shipping,
        total,
        notes: createPurchaseOrderDto.notes,
        status: POStatus.PENDING,
        items: {
          create: createPurchaseOrderDto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            subtotal: item.quantity * item.unitPrice - (item.discount || 0),
          })),
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return this.transformPO(po);
  }

  async findAll() {
    const pos = await this.prisma.purchaseOrder.findMany({
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pos.map((po) => this.transformPO(po));
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    return this.transformPO(po);
  }

  async update(id: string, updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!po) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    const updateData: any = {};

    if (updatePurchaseOrderDto.status) {
      updateData.status = updatePurchaseOrderDto.status;
    }

    if (updatePurchaseOrderDto.expectedDate) {
      updateData.expectedDate = new Date(updatePurchaseOrderDto.expectedDate);
    }

    if (updatePurchaseOrderDto.notes !== undefined) {
      updateData.notes = updatePurchaseOrderDto.notes;
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async receiveStock(id: string, receiveStockDto: ReceiveStockDto, userId?: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    if (po.status === POStatus.RECEIVED) {
      throw new BadRequestException('Purchase order has already been fully received');
    }

    if (po.status === POStatus.CANCELLED) {
      throw new BadRequestException('Cannot receive stock for a cancelled purchase order');
    }

    // Update received quantities and stock
    let allReceived = true;
    for (const receiveItem of receiveStockDto.items) {
      const poItem = po.items.find((item) => item.productId === receiveItem.productId);
      if (!poItem) {
        throw new NotFoundException(
          `Product ${receiveItem.productId} not found in purchase order`,
        );
      }

      const newReceivedQty = poItem.receivedQty + receiveItem.quantity;
      if (newReceivedQty > poItem.quantity) {
        throw new BadRequestException(
          `Cannot receive more than ordered quantity for product ${poItem.product.name}`,
        );
      }

      await this.prisma.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: { receivedQty: newReceivedQty },
      });

      // Update inventory
      const inventoryItem = await this.prisma.inventoryItem.findFirst({
        where: { productId: receiveItem.productId },
      });

      if (inventoryItem) {
        const newQuantity = inventoryItem.quantity + receiveItem.quantity;
        await this.prisma.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { quantity: newQuantity },
        });

        // Create stock movement
        await this.prisma.stockMovement.create({
          data: {
            productId: receiveItem.productId,
            inventoryId: inventoryItem.id,
            type: StockMovementType.IN,
            quantity: receiveItem.quantity,
            reason: `Received from PO ${po.poNumber}`,
            reference: po.id,
            referenceType: 'purchase_order',
            createdBy: userId,
          },
        });
      }

      if (newReceivedQty < poItem.quantity) {
        allReceived = false;
      }
    }

    // Update PO status
    const newStatus = allReceived ? POStatus.RECEIVED : POStatus.PARTIALLY_RECEIVED;
    const receivedDate = allReceived ? new Date() : null;

    await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: newStatus,
        receivedDate,
      },
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!po) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    if (po.status === POStatus.RECEIVED) {
      throw new BadRequestException('Cannot delete a received purchase order');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: POStatus.CANCELLED },
    });
  }

  private transformPO(po: any) {
    return {
      id: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: po.supplier.name,
      items: po.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        unitCost: Number(item.unitPrice),
        received: item.receivedQty,
      })),
      subtotal: Number(po.subtotal),
      tax: Number(po.tax),
      shipping: Number(po.shipping),
      total: Number(po.total),
      status: po.status.toLowerCase() as 'draft' | 'pending' | 'partial' | 'received' | 'cancelled',
      expectedDate: po.expectedDate?.toISOString(),
      receivedDate: po.receivedDate?.toISOString(),
      createdAt: po.createdAt.toISOString(),
      notes: po.notes,
    };
  }
}

