import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Total orders
    const totalOrders = await this.prisma.order.count();

    // Total revenue (sum of all order totals)
    const revenueResult = await this.prisma.order.aggregate({
      _sum: { total: true },
    });
    const revenue = revenueResult._sum.total || 0;

    // New clients this month
    const newClients = await this.prisma.client.count({
      where: {
        createdAt: { gte: startOfMonth },
      },
    });

    // Low stock products (quantity < 10 in inventory)
    const lowStockItems = await this.prisma.inventoryItem.findMany({
      where: {
        quantity: { lt: 10 },
        product: {
          isActive: true,
        },
      },
      select: {
        productId: true,
      },
    });
    const lowStockCount = new Set(lowStockItems.map(item => item.productId)).size;

    return {
      totalOrders,
      revenue: Number(revenue),
      newClients,
      lowStockCount,
    };
  }

  async getRevenueTrends(days: number = 7) {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        total: true,
        createdAt: true,
      },
    });

    // Group by date (YYYY-MM-DD)
    const dailyRevenue: { [key: string]: number } = {};
    orders.forEach((order) => {
      const date = new Date(order.createdAt);
      const dateKey = date.toISOString().split('T')[0];
      dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + Number(order.total);
    });

    // Get last N days in order with day names
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      result.push({
        name: dayName,
        revenue: dailyRevenue[dateKey] || 0,
      });
    }

    return result;
  }

  async getSalesByCategory() {
    const orders = await this.prisma.order.findMany({
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    const categorySales: { [key: string]: number } = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const categoryName = item.product.category?.name || 'Uncategorized';
        categorySales[categoryName] =
          (categorySales[categoryName] || 0) + Number(item.subtotal);
      });
    });

    return Object.entries(categorySales).map(([name, value]) => ({
      name,
      value: Number(value),
    }));
  }

  async getTopProducts(limit: number = 5) {
    const orders = await this.prisma.order.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const productSales: {
      [key: string]: { name: string; quantity: number; revenue: number };
    } = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const productId = item.productId;
        if (!productSales[productId]) {
          productSales[productId] = {
            name: item.product.name,
            quantity: 0,
            revenue: 0,
          };
        }
        productSales[productId].quantity += item.quantity;
        productSales[productId].revenue += Number(item.subtotal);
      });
    });

    return Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  async getOrderStatusDistribution() {
    const orders = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    return orders.map((item) => ({
      name: item.status,
      value: item._count.status,
    }));
  }
}

