import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminEmail = 'admin@kaksingri.com';
  const adminPassword = 'admin123'; // Change this in production!

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists');
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'Admin User',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    console.log('✅ Admin user created:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role: ${admin.role}`);
    console.log('   ⚠️  Please change the password after first login!');
  }

  // Create sample categories
  const categories = [
    { name: 'Jeans', slug: 'jeans', description: 'Denim jeans collection' },
    { name: 'Jackets', slug: 'jackets', description: 'Denim jackets' },
    { name: 'Shirts', slug: 'shirts', description: 'Denim shirts' },
    { name: 'Shorts', slug: 'shorts', description: 'Denim shorts' },
  ];

  for (const category of categories) {
    const existing = await prisma.category.findUnique({
      where: { slug: category.slug },
    });

    if (!existing) {
      await prisma.category.create({
        data: category,
      });
      console.log(`✅ Created category: ${category.name}`);
    }
  }

  // Create sample settings
  const settings = [
    {
      key: 'site_name',
      value: { name: 'Kaksingri Denim' },
      category: 'general',
    },
    {
      key: 'site_logo',
      value: { url: '/logo.png' },
      category: 'theme',
    },
    {
      key: 'primary_color',
      value: { color: '#4F46E5' }, // Indigo
      category: 'theme',
    },
    {
      key: 'secondary_color',
      value: { color: '#B87333' }, // Copper
      category: 'theme',
    },
  ];

  for (const setting of settings) {
    const existing = await prisma.setting.findUnique({
      where: { key: setting.key },
    });

    if (!existing) {
      await prisma.setting.create({
        data: setting,
      });
      console.log(`✅ Created setting: ${setting.key}`);
    }
  }

  // Create sample products
  console.log('\n📦 Creating sample products...');
  
  const jeansCategory = await prisma.category.findUnique({
    where: { slug: 'jeans' },
  });
  
  const jacketsCategory = await prisma.category.findUnique({
    where: { slug: 'jackets' },
  });

  if (jeansCategory) {
    const jeansProducts = [
      {
        name: 'Classic Straight Fit Jeans',
        slug: 'classic-straight-fit-jeans',
        sku: 'JEANS-001',
        description: 'Our signature straight-fit jeans crafted from premium denim. Perfect for everyday wear with a timeless silhouette.',
        price: 89.99,
        comparePrice: 119.99,
        cost: 45.00,
        categoryId: jeansCategory.id,
        images: ['https://images.unsplash.com/photo-1542272604-787c3835535d?w=800'],
        tags: ['classic', 'straight-fit', 'premium'],
        isActive: true,
        isFeatured: true,
        trackInventory: true,
        weight: 0.8,
        dimensions: { length: 100, width: 30, height: 5 },
        metadata: {
          sizes: ['28', '30', '32', '34', '36', '38'],
          colors: ['Indigo', 'Black', 'Light Blue'],
          fit: 'Straight',
          gender: ['Men', 'Women'],
        },
      },
      {
        name: 'Slim Fit Denim Jeans',
        slug: 'slim-fit-denim-jeans',
        sku: 'JEANS-002',
        description: 'Modern slim-fit jeans with a tapered leg. Made from stretch denim for comfort and style.',
        price: 94.99,
        comparePrice: 129.99,
        cost: 48.00,
        categoryId: jeansCategory.id,
        images: ['https://images.unsplash.com/photo-1582418702059-97ebafb3e3e8?w=800'],
        tags: ['slim-fit', 'stretch', 'modern'],
        isActive: true,
        isFeatured: true,
        trackInventory: true,
        weight: 0.75,
        dimensions: { length: 98, width: 28, height: 5 },
        metadata: {
          sizes: ['28', '30', '32', '34', '36'],
          colors: ['Indigo', 'Black'],
          fit: 'Slim',
          gender: ['Men'],
        },
      },
      {
        name: 'Wide Leg Denim Jeans',
        slug: 'wide-leg-denim-jeans',
        sku: 'JEANS-003',
        description: 'Trendy wide-leg jeans with a relaxed fit. Perfect for a contemporary look.',
        price: 99.99,
        comparePrice: 139.99,
        cost: 50.00,
        categoryId: jeansCategory.id,
        images: ['https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800'],
        tags: ['wide-leg', 'relaxed', 'trendy'],
        isActive: true,
        isFeatured: false,
        trackInventory: true,
        weight: 0.85,
        dimensions: { length: 102, width: 35, height: 5 },
        metadata: {
          sizes: ['26', '28', '30', '32', '34'],
          colors: ['Indigo', 'Light Blue'],
          fit: 'Wide Leg',
          gender: ['Women'],
        },
      },
    ];

    for (const productData of jeansProducts) {
      const existing = await prisma.product.findUnique({
        where: { slug: productData.slug },
      });

      if (!existing) {
        const product = await prisma.product.create({
          data: productData,
        });

        // Create inventory items for each size
        const sizes = productData.metadata?.sizes || ['30', '32', '34'];
        for (const size of sizes) {
          await prisma.inventoryItem.create({
            data: {
              productId: product.id,
              sku: `${product.sku}-${size}`,
              quantity: Math.floor(Math.random() * 50) + 10, // Random stock between 10-60
              reorderPoint: 10,
              reorderQty: 20,
              location: 'Main Warehouse',
            },
          });
        }

        console.log(`✅ Created product: ${product.name} (${sizes.length} variants)`);
      }
    }
  }

  if (jacketsCategory) {
    const jacketProducts = [
      {
        name: 'Classic Denim Jacket',
        slug: 'classic-denim-jacket',
        sku: 'JACKET-001',
        description: 'Timeless denim jacket with a classic fit. Perfect for layering in any season.',
        price: 119.99,
        comparePrice: 159.99,
        cost: 60.00,
        categoryId: jacketsCategory.id,
        images: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800'],
        tags: ['classic', 'jacket', 'versatile'],
        isActive: true,
        isFeatured: true,
        trackInventory: true,
        weight: 0.6,
        dimensions: { length: 70, width: 50, height: 3 },
        metadata: {
          sizes: ['S', 'M', 'L', 'XL'],
          colors: ['Indigo', 'Black'],
          fit: 'Regular',
          gender: ['Men', 'Women'],
        },
      },
      {
        name: 'Oversized Denim Jacket',
        slug: 'oversized-denim-jacket',
        sku: 'JACKET-002',
        description: 'Comfortable oversized denim jacket with a relaxed fit. Perfect for a casual, laid-back look.',
        price: 129.99,
        comparePrice: 169.99,
        cost: 65.00,
        categoryId: jacketsCategory.id,
        images: ['https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800'],
        tags: ['oversized', 'relaxed', 'casual'],
        isActive: true,
        isFeatured: false,
        trackInventory: true,
        weight: 0.7,
        dimensions: { length: 75, width: 55, height: 3 },
        metadata: {
          sizes: ['S', 'M', 'L', 'XL'],
          colors: ['Indigo', 'Light Blue'],
          fit: 'Oversized',
          gender: ['Women'],
        },
      },
    ];

    for (const productData of jacketProducts) {
      const existing = await prisma.product.findUnique({
        where: { slug: productData.slug },
      });

      if (!existing) {
        const product = await prisma.product.create({
          data: productData,
        });

        // Create inventory items for each size
        const sizes = productData.metadata?.sizes || ['M', 'L'];
        for (const size of sizes) {
          await prisma.inventoryItem.create({
            data: {
              productId: product.id,
              sku: `${product.sku}-${size}`,
              quantity: Math.floor(Math.random() * 40) + 5, // Random stock between 5-45
              reorderPoint: 5,
              reorderQty: 15,
              location: 'Main Warehouse',
            },
          });
        }

        console.log(`✅ Created product: ${product.name} (${sizes.length} variants)`);
      }
    }
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📝 Login credentials:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log('\n📦 Sample products created with inventory items');
  console.log('\n⚠️  IMPORTANT: Change the admin password after first login!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

