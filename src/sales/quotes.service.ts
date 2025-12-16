import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

@Injectable()
export class QuotesService {
  constructor(private prisma: PrismaService) {}

  async create(createQuoteDto: CreateQuoteDto) {
    // Generate quote number
    const quoteCount = await this.prisma.quote.count();
    const quoteNumber = `QUO-${String(quoteCount + 1).padStart(6, '0')}`;

    return this.prisma.quote.create({
      data: {
        ...createQuoteDto,
        quoteNumber,
        items: {
          create: createQuoteDto.items,
        },
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
  }

  async findAll() {
    return this.prisma.quote.findMany({
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
  }

  async findOne(id: string) {
    const quote = await this.prisma.quote.findUnique({
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
    if (!quote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }
    return quote;
  }

  async update(id: string, updateQuoteDto: UpdateQuoteDto) {
    // Extract items if present (nested updates need special handling)
    const { items, ...quoteData } = updateQuoteDto as any;
    
    return this.prisma.quote.update({
      where: { id },
      data: quoteData as any,
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

  async remove(id: string) {
    return this.prisma.quote.delete({
      where: { id },
    });
  }
}

