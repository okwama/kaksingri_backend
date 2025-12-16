import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import * as XLSX from 'xlsx';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async exportOrdersToCSV(startDate?: Date, endDate?: Date): Promise<string> {
    const orders = await this.prisma.order.findMany({
      where: {
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        client: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const csvRows = [
      [
        'Order Number',
        'Date',
        'Customer Name',
        'Customer Email',
        'Status',
        'Payment Status',
        'Subtotal',
        'Tax',
        'Shipping',
        'Discount',
        'Total',
        'Items',
        'Shipping Address',
      ],
    ];

    orders.forEach((order) => {
      const items = order.items.map((item) => `${item.product?.name || 'N/A'} (x${item.quantity})`).join('; ');
      const shippingAddress = order.shippingAddress
        ? Object.values(order.shippingAddress as any)
            .filter(Boolean)
            .join(', ')
        : 'N/A';

      csvRows.push([
        order.orderNumber,
        order.createdAt.toISOString(),
        order.client?.name || 'N/A',
        order.client?.email || 'N/A',
        order.status,
        order.paymentStatus,
        Number(order.subtotal).toFixed(2),
        Number(order.tax).toFixed(2),
        Number(order.shipping).toFixed(2),
        Number(order.discount).toFixed(2),
        Number(order.total).toFixed(2),
        items,
        shippingAddress,
      ]);
    });

    return csvRows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  }

  async exportOrdersToExcel(startDate?: Date, endDate?: Date): Promise<Buffer> {
    const orders = await this.prisma.order.findMany({
      where: {
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
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
      orderBy: { createdAt: 'desc' },
    });

    const data = orders.map((order) => ({
      'Order Number': order.orderNumber,
      Date: order.createdAt.toISOString().split('T')[0],
      'Customer Name': order.client?.name || 'N/A',
      'Customer Email': order.client?.email || 'N/A',
      'Customer Phone': order.client?.phone || 'N/A',
      Status: order.status,
      'Payment Status': order.paymentStatus,
      'Payment Method': order.paymentMethod?.name || 'N/A',
      Subtotal: Number(order.subtotal),
      Tax: Number(order.tax),
      Shipping: Number(order.shipping),
      Discount: Number(order.discount),
      Total: Number(order.total),
      'Items Count': order.items.length,
      'Shipping Address': order.shippingAddress
        ? Object.values(order.shippingAddress as any)
            .filter(Boolean)
            .join(', ')
        : 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  async exportProductsToCSV(): Promise<string> {
    const products = await this.prisma.product.findMany({
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const csvRows = [
      [
        'SKU',
        'Name',
        'Category',
        'Price',
        'Stock',
        'Status',
        'Description',
        'Created At',
      ],
    ];

    products.forEach((product) => {
      csvRows.push([
        product.sku || 'N/A',
        product.name,
        product.category?.name || 'N/A',
        Number(product.price).toFixed(2),
        'N/A', // Stock would need to be calculated from inventory
        product.isActive ? 'Active' : 'Inactive',
        (product.description || '').substring(0, 100),
        product.createdAt.toISOString().split('T')[0],
      ]);
    });

    return csvRows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  }

  async exportProductsToExcel(): Promise<Buffer> {
    const products = await this.prisma.product.findMany({
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = products.map((product) => ({
      SKU: product.sku || 'N/A',
      Name: product.name,
      Category: product.category?.name || 'N/A',
      Price: Number(product.price),
      Status: product.isActive ? 'Active' : 'Inactive',
      Description: (product.description || '').substring(0, 200),
      'Created At': product.createdAt.toISOString().split('T')[0],
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  async exportClientsToCSV(): Promise<string> {
    const clients = await this.prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const csvRows = [
      ['Name', 'Email', 'Phone', 'Address', 'City', 'Country', 'Company', 'Status', 'Created At'],
    ];

    clients.forEach((client) => {
      csvRows.push([
        client.name,
        client.email,
        client.phone || 'N/A',
        client.address || 'N/A',
        client.city || 'N/A',
        client.country || 'N/A',
        client.company || 'N/A',
        client.isActive ? 'Active' : 'Inactive',
        client.createdAt.toISOString().split('T')[0],
      ]);
    });

    return csvRows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  }

  async exportClientsToExcel(): Promise<Buffer> {
    const clients = await this.prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const data = clients.map((client) => ({
      Name: client.name,
      Email: client.email,
      Phone: client.phone || 'N/A',
      Address: client.address || 'N/A',
      City: client.city || 'N/A',
      Country: client.country || 'N/A',
      Company: client.company || 'N/A',
      'Tax ID': client.taxId || 'N/A',
      Status: client.isActive ? 'Active' : 'Inactive',
      'Created At': client.createdAt.toISOString().split('T')[0],
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  async exportInventoryReport(): Promise<Buffer> {
    const inventoryItems = await this.prisma.inventoryItem.findMany({
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const data = inventoryItems.map((item) => ({
      'Product SKU': item.product?.sku || 'N/A',
      'Product Name': item.product?.name || 'N/A',
      Warehouse: item.warehouse?.name || 'N/A',
      'Current Stock': Number(item.quantity),
      'Reserved Stock': Number(item.reservedQty || 0),
      'Available Stock': Number(item.quantity) - Number(item.reservedQty || 0),
      'Reorder Point': Number(item.reorderPoint || 0),
      'Last Updated': item.updatedAt.toISOString().split('T')[0],
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  async exportPaymentTransactions(startDate?: Date, endDate?: Date): Promise<Buffer> {
    const transactions = await this.prisma.paymentTransaction.findMany({
      where: {
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        order: {
          include: {
            client: true,
          },
        },
        paymentMethod: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = transactions.map((transaction) => ({
      'Transaction ID': transaction.transactionId || 'N/A',
      'Order Number': transaction.order.orderNumber,
      'Customer': transaction.order.client?.name || 'N/A',
      'Payment Method': transaction.paymentMethod?.name || 'N/A',
      Amount: Number(transaction.amount),
      Currency: transaction.currency,
      Status: transaction.status,
      'Paid At': transaction.paidAt ? transaction.paidAt.toISOString().split('T')[0] : 'N/A',
      'Created At': transaction.createdAt.toISOString().split('T')[0],
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Transactions');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}

