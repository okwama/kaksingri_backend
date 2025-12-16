import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

// Core modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { ClientsModule } from './clients/clients.module';
import { MarketingModule } from './marketing/marketing.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SettingsModule } from './settings/settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadModule } from './upload/upload.module';
import { PaymentsModule } from './payments/payments.module';
import { ExportModule } from './export/export.module';
import { HeroImagesModule } from './hero-images/hero-images.module';
import { ReviewsModule } from './reviews/reviews.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Feature modules
    CommonModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    OrdersModule,
    InventoryModule,
    SalesModule,
    ClientsModule,
    MarketingModule,
    AnalyticsModule,
    SettingsModule,
    NotificationsModule,
    UploadModule,
    PaymentsModule,
    ExportModule,
    HeroImagesModule,
    ReviewsModule,
    LoyaltyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

