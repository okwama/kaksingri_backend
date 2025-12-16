import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  controllers: [SalesController, QuotesController],
  providers: [SalesService, QuotesService],
  exports: [SalesService, QuotesService],
})
export class SalesModule {}

