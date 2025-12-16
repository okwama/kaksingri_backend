import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(createSupplierDto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: createSupplierDto,
    });
  }

  async findAll() {
    const suppliers = await this.prisma.supplier.findMany({
      include: {
        purchaseOrders: {
          select: {
            id: true,
            total: true,
            orderDate: true,
            status: true,
          },
          orderBy: { orderDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return suppliers.map((supplier) => {
      const totalOrders = supplier.purchaseOrders.length;
      const totalValue = supplier.purchaseOrders.reduce(
        (sum, po) => sum + Number(po.total),
        0,
      );
      const lastOrder = supplier.purchaseOrders[0];

      return {
        id: supplier.id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        totalOrders,
        totalValue,
        lastOrderDate: lastOrder?.orderDate?.toISOString(),
        notes: supplier.notes,
        isActive: supplier.isActive,
      };
    });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
          orderBy: { orderDate: 'desc' },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return this.prisma.supplier.update({
      where: { id },
      data: updateSupplierDto,
    });
  }

  async remove(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

