import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma, ReviewStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    productId?: string;
    clientId?: string;
    status?: ReviewStatus;
    rating?: number;
  }) {
    const where: Prisma.ProductReviewWhereInput = {};

    if (filters?.productId) {
      where.productId = filters.productId;
    }
    if (filters?.clientId) {
      where.clientId = filters.clientId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.rating) {
      where.rating = filters.rating;
    }

    return this.prisma.productReview.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const review = await this.prisma.productReview.findUnique({
      where: { id },
      include: {
        product: true,
        client: true,
      },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    return review;
  }

  async create(data: Prisma.ProductReviewCreateInput) {
    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Check if client already reviewed this product
    if (data.client?.connect?.id) {
      const existingReview = await this.prisma.productReview.findFirst({
        where: {
          productId: (data.product as any).connect.id,
          clientId: (data.client as any).connect.id,
        },
      });

      if (existingReview) {
        throw new BadRequestException('Client has already reviewed this product');
      }
    }

    return this.prisma.productReview.create({
      data,
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async update(id: string, data: Prisma.ProductReviewUpdateInput) {
    await this.findOne(id); // Verify exists

    if (data.rating && (data.rating as number < 1 || data.rating as number > 5)) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    return this.prisma.productReview.update({
      where: { id },
      data,
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Verify exists
    return this.prisma.productReview.delete({
      where: { id },
    });
  }

  async getProductStats(productId: string) {
    const reviews = await this.prisma.productReview.findMany({
      where: {
        productId,
        status: ReviewStatus.APPROVED,
      },
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0,
        },
      };
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    const ratingDistribution = reviews.reduce(
      (acc, review) => {
        acc[review.rating as keyof typeof acc]++;
        return acc;
      },
      { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    );

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: reviews.length,
      ratingDistribution,
    };
  }
}

