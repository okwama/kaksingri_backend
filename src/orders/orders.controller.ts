import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Put, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { UpdateReturnRequestDto } from './dto/update-return-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Create a new order (public - for checkout)' })
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders' })
  findAll(@Request() req) {
    // If user is a client (type: 'client'), return only their orders
    if (req.user?.type === 'client') {
      return this.ordersService.findByClientId(req.user.sub);
    }
    // Otherwise, return all orders (admin)
    return this.ordersService.findAll();
  }

  @Get('my-orders')
  @ApiOperation({ summary: 'Get current client orders' })
  getMyOrders(@Request() req) {
    if (req.user?.type !== 'client') {
      throw new Error('This endpoint is only for clients');
    }
    return this.ordersService.findByClientId(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update order' })
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.ordersService.updateStatus(id, body.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete order' })
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }

  // Return Request endpoints
  @Post('returns')
  @ApiOperation({ summary: 'Create a return request' })
  createReturnRequest(@Body() createReturnRequestDto: CreateReturnRequestDto) {
    return this.ordersService.createReturnRequest(createReturnRequestDto);
  }

  @Get('returns')
  @ApiOperation({ summary: 'Get all return requests' })
  findAllReturnRequests() {
    return this.ordersService.findAllReturnRequests();
  }

  @Get('returns/:id')
  @ApiOperation({ summary: 'Get return request by ID' })
  findOneReturnRequest(@Param('id') id: string) {
    return this.ordersService.findOneReturnRequest(id);
  }

  @Put('returns/:id')
  @ApiOperation({ summary: 'Update return request' })
  updateReturnRequest(@Param('id') id: string, @Body() updateReturnRequestDto: UpdateReturnRequestDto) {
    return this.ordersService.updateReturnRequest(id, updateReturnRequestDto);
  }
}

