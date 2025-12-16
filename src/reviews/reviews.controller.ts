import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { ReviewStatus } from '@prisma/client';

@ApiTags('Product Reviews')
@Controller('products/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Create a product review (public)' })
  create(@Body() createDto: CreateReviewDto) {
    return this.reviewsService.create({
      product: { connect: { id: createDto.productId } },
      ...(createDto.clientId
        ? { client: { connect: { id: createDto.clientId } } }
        : {}),
      customerName: createDto.customerName,
      customerEmail: createDto.customerEmail,
      rating: createDto.rating,
      comment: createDto.comment,
      status: ReviewStatus.PENDING,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reviews (admin)' })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ReviewStatus })
  @ApiQuery({ name: 'rating', required: false })
  findAll(
    @Query('productId') productId?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: ReviewStatus,
    @Query('rating') rating?: string,
  ) {
    return this.reviewsService.findAll({
      productId,
      clientId,
      status,
      rating: rating ? parseInt(rating) : undefined,
    });
  }

  @Get('product/:productId')
  @Public()
  @ApiOperation({ summary: 'Get approved reviews for a product (public)' })
  getProductReviews(@Param('productId') productId: string) {
    return this.reviewsService.findAll({
      productId,
      status: ReviewStatus.APPROVED,
    });
  }

  @Get('product/:productId/stats')
  @Public()
  @ApiOperation({ summary: 'Get review statistics for a product (public)' })
  getProductStats(@Param('productId') productId: string) {
    return this.reviewsService.getProductStats(productId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a review by ID' })
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a review (admin)' })
  update(@Param('id') id: string, @Body() updateDto: UpdateReviewDto) {
    const updateData: any = { ...updateDto };
    if (updateDto.productId) {
      updateData.product = { connect: { id: updateDto.productId } };
      delete updateData.productId;
    }
    if (updateDto.clientId) {
      updateData.client = { connect: { id: updateDto.clientId } };
      delete updateData.clientId;
    }

    return this.reviewsService.update(id, updateData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a review' })
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}

