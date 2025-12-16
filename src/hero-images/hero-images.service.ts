import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class HeroImagesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.heroImage.findMany({
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findActive() {
    const now = new Date();
    return this.prisma.heroImage.findFirst({
      where: {
        isActive: true,
        OR: [
          {
            startDate: null,
            endDate: null,
          },
          {
            startDate: { lte: now },
            endDate: { gte: now },
          },
          {
            startDate: { lte: now },
            endDate: null,
          },
          {
            startDate: null,
            endDate: { gte: now },
          },
        ],
      },
      orderBy: { priority: 'desc' },
    });
  }

  async findOne(id: string) {
    const hero = await this.prisma.heroImage.findUnique({
      where: { id },
    });

    if (!hero) {
      throw new NotFoundException(`Hero image with ID ${id} not found`);
    }

    return hero;
  }

  async create(data: Prisma.HeroImageCreateInput) {
    // If setting as active, deactivate others
    if (data.isActive) {
      await this.prisma.heroImage.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    return this.prisma.heroImage.create({
      data,
    });
  }

  async update(id: string, data: Prisma.HeroImageUpdateInput) {
    await this.findOne(id); // Verify exists

    // If setting as active, deactivate others
    if (data.isActive === true) {
      await this.prisma.heroImage.updateMany({
        where: {
          isActive: true,
          id: { not: id },
        },
        data: { isActive: false },
      });
    }

    return this.prisma.heroImage.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Verify exists
    return this.prisma.heroImage.delete({
      where: { id },
    });
  }

  /**
   * Check and update active status based on scheduling dates
   * This should be called periodically (e.g., via cron job)
   */
  async updateScheduledHeroes() {
    const now = new Date();
    
    // Deactivate heroes that have passed their end date
    await this.prisma.heroImage.updateMany({
      where: {
        isActive: true,
        endDate: { lt: now },
      },
      data: { isActive: false },
    });

    // Activate heroes that should be active based on start date
    const heroesToActivate = await this.prisma.heroImage.findMany({
      where: {
        isActive: false,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    if (heroesToActivate.length > 0) {
      // Deactivate all current active heroes
      await this.prisma.heroImage.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      // Activate the highest priority hero
      await this.prisma.heroImage.update({
        where: { id: heroesToActivate[0].id },
        data: { isActive: true },
      });
    }
  }
}

