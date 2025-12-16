import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Payments')
@Controller('payments/methods')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new payment method' })
  create(@Body() createPaymentMethodDto: CreatePaymentMethodDto) {
    return this.paymentMethodsService.create(createPaymentMethodDto);
  }

  @Get('encryption-key/info')
  @ApiOperation({ summary: 'Get encryption key information' })
  getEncryptionKeyInfo() {
    return this.paymentMethodsService.getEncryptionKeySetting();
  }

  @Post('encryption-key/generate')
  @ApiOperation({ summary: 'Generate a new encryption key' })
  async generateEncryptionKey() {
    const key = await this.paymentMethodsService.generateNewKey();
    return { key };
  }

  @Post('encryption-key/set')
  @ApiOperation({ summary: 'Set encryption key (with optional credential re-encryption)' })
  async setEncryptionKey(@Body() body: { key: string; regenerateCredentials?: boolean }) {
    await this.paymentMethodsService.setEncryptionKey(body.key, body.regenerateCredentials ?? false);
    return { success: true, message: 'Encryption key updated successfully' };
  }

  @Get('active')
  @Public()
  @ApiOperation({ summary: 'Get active payment methods (public - for checkout)' })
  getActiveMethods() {
    return this.paymentMethodsService.getActiveMethods();
  }

  @Get(':id/publishable-key')
  @Public()
  @ApiOperation({ summary: 'Get publishable key for payment method (public - for Stripe/PayPal)' })
  async getPublishableKey(@Param('id') id: string) {
    const method = await this.paymentMethodsService.findOne(id, true);
    if (method.type === 'STRIPE') {
      return { publishableKey: method.credentials.publishableKey };
    }
    if (method.type === 'PAYPAL') {
      return { clientId: method.credentials.clientId };
    }
    throw new BadRequestException('Payment method does not have a publishable key');
  }

  @Get()
  @ApiOperation({ summary: 'Get all payment methods' })
  findAll(@Query('includeCredentials') includeCredentials?: string) {
    return this.paymentMethodsService.findAll(includeCredentials === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment method by ID' })
  findOne(@Param('id') id: string, @Query('includeCredentials') includeCredentials?: string) {
    return this.paymentMethodsService.findOne(id, includeCredentials === 'true');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update payment method' })
  update(@Param('id') id: string, @Body() updatePaymentMethodDto: UpdatePaymentMethodDto) {
    return this.paymentMethodsService.update(id, updatePaymentMethodDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete payment method' })
  remove(@Param('id') id: string) {
    return this.paymentMethodsService.remove(id);
  }
}

