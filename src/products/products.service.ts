import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  async create(createProductDto: any, files?: Express.Multer.File[]) {
    // Parse form data
    const productData: any = {
      name: createProductDto.name,
      slug: createProductDto.slug || createProductDto.name.toLowerCase().replace(/\s+/g, '-'),
      sku: createProductDto.sku || `SKU-${Date.now()}`,
      description: createProductDto.description,
      price: parseFloat(createProductDto.price),
      categoryId: createProductDto.categoryId,
      isActive: createProductDto.status === 'active' || createProductDto.isActive !== false,
    };

    // Handle optional fields
    if (createProductDto.comparePrice) productData.comparePrice = parseFloat(createProductDto.comparePrice);
    if (createProductDto.cost) productData.cost = parseFloat(createProductDto.cost);
    if (createProductDto.weight) productData.weight = parseFloat(createProductDto.weight);

    // Parse variants from JSON strings if present
    const sizes = createProductDto.sizes ? (typeof createProductDto.sizes === 'string' ? JSON.parse(createProductDto.sizes) : createProductDto.sizes) : [];
    const colors = createProductDto.colors ? (typeof createProductDto.colors === 'string' ? JSON.parse(createProductDto.colors) : createProductDto.colors) : [];
    const fit = createProductDto.fit ? (typeof createProductDto.fit === 'string' ? JSON.parse(createProductDto.fit) : createProductDto.fit) : [];
    const gender = createProductDto.gender ? (typeof createProductDto.gender === 'string' ? JSON.parse(createProductDto.gender) : createProductDto.gender) : [];

    // Store variants in metadata
    productData.metadata = {
      sizes,
      colors,
      fit: Array.isArray(fit) ? fit : [fit],
      gender,
    };

    // Upload images
    const imageUrls: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const uploadResult = await this.uploadService.uploadFile(file, 'products');
        imageUrls.push(uploadResult.url);
      }
    }
    productData.images = imageUrls;

    // Create product
    const product = await this.prisma.product.create({
      data: productData,
      include: { category: true },
    });

    // Create inventory items for each size variant
    if (sizes.length > 0 && createProductDto.trackInventory !== false) {
      const stock = parseInt(createProductDto.stock || '0');
      const stockPerSize = Math.floor(stock / sizes.length) || 0;
      
      for (const size of sizes) {
        await this.prisma.inventoryItem.create({
          data: {
            productId: product.id,
            sku: `${product.sku}-${size}`,
            quantity: stockPerSize,
            reorderPoint: 10,
            reorderQty: 20,
            location: 'Main Warehouse',
          },
        });
      }
    } else if (createProductDto.trackInventory !== false) {
      // Create single inventory item if no sizes
      await this.prisma.inventoryItem.create({
        data: {
          productId: product.id,
          sku: product.sku,
          quantity: parseInt(createProductDto.stock || '0'),
          reorderPoint: 10,
          reorderQty: 20,
          location: 'Main Warehouse',
        },
      });
    }

    return this.prisma.product.findUnique({
      where: { id: product.id },
      include: { category: true, inventoryItems: true },
    });
  }

  async findAll() {
    return this.prisma.product.findMany({
      include: { 
        category: true,
        inventoryItems: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { 
        category: true,
        inventoryItems: true,
      },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: any, files?: Express.Multer.File[]) {
    const existingProduct = await this.prisma.product.findUnique({
      where: { id },
      include: { inventoryItems: true },
    });

    if (!existingProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const updateData: any = {};

    if (updateProductDto.name) updateData.name = updateProductDto.name;
    if (updateProductDto.description !== undefined) updateData.description = updateProductDto.description;
    if (updateProductDto.price) updateData.price = parseFloat(updateProductDto.price);
    if (updateProductDto.categoryId) updateData.categoryId = updateProductDto.categoryId;
    if (updateProductDto.status !== undefined) {
      updateData.isActive = updateProductDto.status === 'active';
    }

    // Parse and update variants
    if (updateProductDto.sizes || updateProductDto.colors || updateProductDto.fit || updateProductDto.gender) {
      // Safely access metadata with type assertion
      const existingMetadata = (existingProduct.metadata as any) || {};
      const sizes = updateProductDto.sizes ? (typeof updateProductDto.sizes === 'string' ? JSON.parse(updateProductDto.sizes) : updateProductDto.sizes) : existingMetadata.sizes || [];
      const colors = updateProductDto.colors ? (typeof updateProductDto.colors === 'string' ? JSON.parse(updateProductDto.colors) : updateProductDto.colors) : existingMetadata.colors || [];
      const fit = updateProductDto.fit ? (typeof updateProductDto.fit === 'string' ? JSON.parse(updateProductDto.fit) : updateProductDto.fit) : existingMetadata.fit || [];
      const gender = updateProductDto.gender ? (typeof updateProductDto.gender === 'string' ? JSON.parse(updateProductDto.gender) : updateProductDto.gender) : existingMetadata.gender || [];

      updateData.metadata = {
        ...(existingMetadata || {}),
        sizes,
        colors,
        fit: Array.isArray(fit) ? fit : [fit],
        gender,
      };
    }

    // Upload new images and append to existing
    if (files && files.length > 0) {
      const imageUrls: string[] = [...(existingProduct.images || [])];
      for (const file of files) {
        const uploadResult = await this.uploadService.uploadFile(file, 'products');
        imageUrls.push(uploadResult.url);
      }
      updateData.images = imageUrls;
    }

    return this.prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true, inventoryItems: true },
    });
  }

  async remove(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }

  async findLowStock() {
    const lowStockItems = await this.prisma.inventoryItem.findMany({
      where: {
        quantity: { lt: 10 },
        product: {
          isActive: true,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { quantity: 'asc' },
    });

    // Transform to match expected format
    return lowStockItems.map(item => ({
      id: item.product.id,
      name: item.product.name,
      stock: item.quantity,
      minStock: item.reorderPoint,
    }));
  }
}

