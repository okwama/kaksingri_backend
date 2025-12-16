import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate a unique referral code for a client
   */
  private async generateReferralCode(): Promise<string> {
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

    return referralCode;
  }

  /**
   * Find or create a client by email
   */
  async findOrCreateByEmail(email: string, clientData?: Partial<CreateClientDto>) {
    let client = await this.prisma.client.findUnique({
      where: { email },
    });

    if (!client) {
      // Create new client with referral code
      const referralCode = await this.generateReferralCode();
      const hashedPassword = clientData?.password 
        ? await bcrypt.hash(clientData.password, 10) 
        : null;
      
      client = await this.prisma.client.create({
        data: {
          email,
          name: clientData?.name || email.split('@')[0],
          password: hashedPassword,
          phone: clientData?.phone,
          address: clientData?.address,
          city: clientData?.city,
          country: clientData?.country || 'Kenya',
          company: clientData?.company,
          referralCode,
          loyaltyPointsBalance: 0,
        },
      });

      // Client is automatically enrolled in loyalty program by having a referral code
      // Points will be awarded on first purchase completion
    }

    return client;
  }

  async create(createClientDto: CreateClientDto) {
    // Check if client with email already exists
    const existing = await this.prisma.client.findUnique({
      where: { email: createClientDto.email },
    });

    if (existing) {
      throw new BadRequestException('Client with this email already exists');
    }

    // Generate referral code
    const referralCode = await this.generateReferralCode();

    // Hash password if provided
    const hashedPassword = createClientDto.password 
      ? await bcrypt.hash(createClientDto.password, 10) 
      : null;

    const { password, ...clientData } = createClientDto;

    const client = await this.prisma.client.create({
      data: {
        ...clientData,
        password: hashedPassword,
        referralCode,
        loyaltyPointsBalance: 0,
      },
    });

    // Client is automatically enrolled in loyalty program by having a referral code
    // Points will be awarded on first purchase completion

    return client;
  }

  async findAll() {
    return this.prisma.client.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    return this.prisma.client.update({
      where: { id },
      data: updateClientDto,
    });
  }

  async remove(id: string) {
    return this.prisma.client.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

