import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma, LoyaltyType, PointsType } from '@prisma/client';

@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService) {}

  // ==================== LOYALTY PROGRAMS ====================

  async findAllPrograms() {
    return this.prisma.loyaltyProgram.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActivePrograms() {
    return this.prisma.loyaltyProgram.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneProgram(id: string) {
    const program = await this.prisma.loyaltyProgram.findUnique({
      where: { id },
    });

    if (!program) {
      throw new NotFoundException(`Loyalty program with ID ${id} not found`);
    }

    return program;
  }

  async createProgram(data: Prisma.LoyaltyProgramCreateInput) {
    // Ensure rules is provided (default to empty object if not)
    const programData = {
      ...data,
      rules: data.rules || {},
    };
    return this.prisma.loyaltyProgram.create({
      data: programData,
    });
  }

  async updateProgram(id: string, data: Prisma.LoyaltyProgramUpdateInput) {
    await this.findOneProgram(id);
    return this.prisma.loyaltyProgram.update({
      where: { id },
      data,
    });
  }

  async removeProgram(id: string) {
    await this.findOneProgram(id);
    return this.prisma.loyaltyProgram.delete({
      where: { id },
    });
  }

  // ==================== LOYALTY POINTS ====================

  async getClientPoints(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        loyaltyPoints: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Last 10 transactions
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    return {
      balance: client.loyaltyPointsBalance,
      tier: client.loyaltyTier,
      referralCode: client.referralCode,
      recentTransactions: client.loyaltyPoints,
    };
  }

  async getClientPointsHistory(clientId: string, limit = 50) {
    return this.prisma.loyaltyPoints.findMany({
      where: { clientId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async earnPoints(
    clientId: string,
    points: number,
    orderId?: string,
    description?: string,
  ) {
    if (points <= 0) {
      throw new BadRequestException('Points must be positive');
    }

    // Create points transaction
    const transaction = await this.prisma.loyaltyPoints.create({
      data: {
        clientId,
        points,
        type: PointsType.EARNED,
        orderId,
        description: description || `Earned ${points} points`,
      },
    });

    // Update client balance
    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        loyaltyPointsBalance: {
          increment: points,
        },
      },
    });

    return transaction;
  }

  async redeemPoints(
    clientId: string,
    points: number,
    orderId?: string,
    description?: string,
  ) {
    if (points <= 0) {
      throw new BadRequestException('Points must be positive');
    }

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    if (client.loyaltyPointsBalance < points) {
      throw new BadRequestException('Insufficient points balance');
    }

    // Create points transaction
    const transaction = await this.prisma.loyaltyPoints.create({
      data: {
        clientId,
        points: -points, // Negative for redemption
        type: PointsType.REDEEMED,
        orderId,
        description: description || `Redeemed ${points} points`,
      },
    });

    // Update client balance
    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        loyaltyPointsBalance: {
          decrement: points,
        },
      },
    });

    return transaction;
  }

  async adjustPoints(
    clientId: string,
    points: number,
    description?: string,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // Create points transaction
    const transaction = await this.prisma.loyaltyPoints.create({
      data: {
        clientId,
        points,
        type: PointsType.ADJUSTED,
        description: description || `Points adjusted by ${points > 0 ? '+' : ''}${points}`,
      },
    });

    // Update client balance
    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        loyaltyPointsBalance: {
          increment: points,
        },
      },
    });

    return transaction;
  }

  async generateReferralCode(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // Generate unique referral code
    let referralCode: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      // Generate random 8-character code
      const randomChars = Math.random().toString(36).substring(2, 10).toUpperCase();
      referralCode = `REF-${randomChars}`;
      
      const existing = await this.prisma.client.findUnique({
        where: { referralCode },
      });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException('Failed to generate unique referral code');
    }

    await this.prisma.client.update({
      where: { id: clientId },
      data: { referralCode },
    });

    return { referralCode };
  }

  /**
   * Calculate points earned from an order
   * This should be called when an order is completed/paid
   */
  async calculatePointsFromOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: true,
      },
    });

    if (!order || !order.clientId) {
      return 0;
    }

    // Get active points program
    const program = await this.prisma.loyaltyProgram.findFirst({
      where: {
        isActive: true,
        type: LoyaltyType.POINTS,
      },
    });

    if (!program) {
      return 0; // No active program
    }

    const rules = program.rules as any;
    const pointsPerDollar = rules?.pointsPerDollar || 1;
    const orderTotal = Number(order.total);

    // Calculate points (round down)
    const points = Math.floor(orderTotal * pointsPerDollar);

    return points;
  }
}

