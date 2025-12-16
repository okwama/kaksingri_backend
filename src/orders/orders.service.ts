import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { EmailService } from '../notifications/email.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { ClientsService } from '../clients/clients.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private clientsService: ClientsService,
    @Inject(forwardRef(() => EmailService))
    private emailService?: EmailService,
    @Inject(forwardRef(() => WhatsAppService))
    private whatsappService?: WhatsAppService,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    // Generate order number
    const orderCount = await this.prisma.order.count();
    const orderNumber = `ORD-${String(orderCount + 1).padStart(6, '0')}`;

    // Extract items and other fields separately to avoid type conflicts
    const { items, customerEmail, customerName, customerPhone, createAccount, password, ...orderData } = createOrderDto as any;
    
    // If createAccount is true and customerEmail is provided, find or create client
    let clientId = orderData.clientId;
    if (createAccount && customerEmail) {
      try {
        const client = await this.clientsService.findOrCreateByEmail(customerEmail, {
          name: customerName,
          phone: customerPhone,
          password: password, // Include password if provided
          address: orderData.shippingAddress?.street,
          city: orderData.shippingAddress?.city,
          country: orderData.shippingAddress?.country || 'Kenya',
        });
        clientId = client.id;
      } catch (error) {
        console.error('Failed to create/find client:', error);
        // Continue without client if creation fails
      }
    }

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        clientId: clientId || orderData.clientId || null,
        status: orderData.status || 'PENDING',
        paymentStatus: orderData.paymentStatus || 'PENDING',
        paymentMethodId: orderData.paymentMethodId || null,
        subtotal: orderData.subtotal,
        tax: orderData.tax,
        shipping: orderData.shipping,
        discount: orderData.discount || 0,
        total: orderData.total,
        shippingAddress: orderData.shippingAddress || null,
        billingAddress: orderData.billingAddress || null,
        notes: orderData.notes || null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            subtotal: (item.unitPrice * item.quantity) - (item.discount || 0),
          })),
        },
      },
      include: {
        client: true,
        paymentMethod: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Send order confirmation email (non-blocking)
    if (this.emailService) {
      const customerEmail = order.client?.email;
      if (customerEmail) {
        this.emailService.sendOrderConfirmation(order, customerEmail).catch((error) => {
          console.error('Failed to send order confirmation email:', error);
        });
      }
    }

    // Send order confirmation WhatsApp (non-blocking)
    if (this.whatsappService) {
      const customerPhone = order.client?.phone;
      if (customerPhone) {
        this.whatsappService.sendOrderConfirmation(order, customerPhone).catch((error) => {
          console.error('Failed to send order confirmation WhatsApp:', error);
        });
      }
    }

    return order;
  }

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        client: true,
        paymentMethod: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByClientId(clientId: string) {
    return this.prisma.order.findMany({
      where: { clientId },
      include: {
        client: true,
        paymentMethod: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        client: true,
        paymentMethod: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    // Extract items if present (nested updates need special handling)
    const { items, ...orderData } = updateOrderDto as any;
    
    return this.prisma.order.update({
      where: { id },
      data: orderData as any,
      include: {
        client: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async updateStatus(id: string, status: string) {
    // Check if order exists first
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      include: {
        client: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!existingOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Normalize status to match Prisma enum (PENDING, CONFIRMED, etc.)
    const normalizedStatus = status.toUpperCase();
    
    // Validate status value
    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    if (!validStatuses.includes(normalizedStatus)) {
      throw new BadRequestException(`Invalid status: ${status}. Valid statuses are: ${validStatuses.join(', ')}`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: { 
        status: normalizedStatus as any,
        ...(normalizedStatus === 'SHIPPED' && !existingOrder.shippedAt ? { shippedAt: new Date() } : {}),
        ...(normalizedStatus === 'DELIVERED' && !existingOrder.deliveredAt ? { deliveredAt: new Date() } : {}),
      },
      include: {
        client: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Send shipping notification email (non-blocking)
    if (this.emailService && normalizedStatus === 'SHIPPED') {
      const customerEmail = updatedOrder.client?.email;
      if (customerEmail) {
        this.emailService.sendShippingUpdate(updatedOrder, customerEmail).catch((error) => {
          console.error('Failed to send shipping notification email:', error);
        });
      }
    }

    // Send order update WhatsApp (non-blocking)
    if (this.whatsappService && ['SHIPPED', 'DELIVERED'].includes(normalizedStatus)) {
      const customerPhone = updatedOrder.client?.phone;
      if (customerPhone) {
        this.whatsappService.sendOrderUpdate(updatedOrder, customerPhone, normalizedStatus).catch((error) => {
          console.error('Failed to send order update WhatsApp:', error);
        });
      }
    }

    return updatedOrder;
  }

  async remove(id: string) {
    return this.prisma.order.delete({
      where: { id },
    });
  }

  // Return Request methods
  async createReturnRequest(createReturnRequestDto: any) {
    // Check if order exists
    const order = await this.prisma.order.findUnique({
      where: { id: createReturnRequestDto.orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${createReturnRequestDto.orderId} not found`);
    }

    // Calculate refund amount if not provided (default to order total)
    const refundAmount = createReturnRequestDto.refundAmount || order.total;

    return this.prisma.returnRequest.create({
      data: {
        orderId: createReturnRequestDto.orderId,
        reason: createReturnRequestDto.reason,
        refundAmount: refundAmount,
        notes: createReturnRequestDto.notes,
      },
      include: {
        order: {
          include: {
            client: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
  }

  async findAllReturnRequests() {
    return this.prisma.returnRequest.findMany({
      include: {
        order: {
          include: {
            client: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneReturnRequest(id: string) {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            client: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!returnRequest) {
      throw new NotFoundException(`Return request with ID ${id} not found`);
    }

    return returnRequest;
  }

  async updateReturnRequest(id: string, updateReturnRequestDto: any) {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id },
    });

    if (!returnRequest) {
      throw new NotFoundException(`Return request with ID ${id} not found`);
    }

    const updateData: any = {};

    if (updateReturnRequestDto.status) {
      updateData.status = updateReturnRequestDto.status;
      
      // If status is REFUNDED, update order status and payment status
      if (updateReturnRequestDto.status === 'REFUNDED') {
        updateData.processedAt = new Date();
        
        // Update order status to REFUNDED
        await this.prisma.order.update({
          where: { id: returnRequest.orderId },
          data: {
            status: 'REFUNDED',
            paymentStatus: 'REFUNDED',
          },
        });
      }
    }

    if (updateReturnRequestDto.refundAmount !== undefined) {
      updateData.refundAmount = updateReturnRequestDto.refundAmount;
    }

    if (updateReturnRequestDto.notes !== undefined) {
      updateData.notes = updateReturnRequestDto.notes;
    }

    return this.prisma.returnRequest.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          include: {
            client: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
  }
}

