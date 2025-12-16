import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class MarketingService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    try {
      // Get active campaigns count
      const activeCampaigns = await this.prisma.campaign.count({
        where: {
          status: 'ACTIVE',
        },
      });

      // Get total email subscribers - using NewsletterSubscriber if it exists
      let totalSubscribers = 0;
      try {
        // Check if NewsletterSubscriber model exists
        if ('newsletterSubscriber' in this.prisma) {
          totalSubscribers = await (this.prisma as any).newsletterSubscriber.count({
            where: {
              isActive: true,
            },
          });
        }
      } catch (error) {
        // NewsletterSubscriber model might not exist yet
        totalSubscribers = 0;
      }

      // Get recent campaigns
      const recentCampaigns = await this.prisma.campaign.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
      });

      return {
        activeCampaigns,
        totalSubscribers,
        recentCampaigns,
      };
    } catch (error) {
      // Return default stats if there's an error
      return {
        activeCampaigns: 0,
        totalSubscribers: 0,
        recentCampaigns: [],
      };
    }
  }
}

