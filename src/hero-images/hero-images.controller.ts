import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { HeroImagesService } from './hero-images.service';
import { CreateHeroImageDto } from './dto/create-hero-image.dto';
import { UpdateHeroImageDto } from './dto/update-hero-image.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { UploadService } from '../upload/upload.service';

@ApiTags('Hero Images')
@Controller('hero-images')
export class HeroImagesController {
  constructor(
    private readonly heroImagesService: HeroImagesService,
    private readonly uploadService: UploadService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new hero image' })
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  async create(
    @Body() createDto: CreateHeroImageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl = createDto.imageUrl;

    if (file) {
      const uploadResult = await this.uploadService.uploadFile(file, 'hero');
      imageUrl = uploadResult.url;
    }

    return this.heroImagesService.create({
      ...createDto,
      imageUrl,
      startDate: createDto.startDate ? new Date(createDto.startDate) : null,
      endDate: createDto.endDate ? new Date(createDto.endDate) : null,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all hero images' })
  findAll() {
    return this.heroImagesService.findAll();
  }

  @Get('active')
  @Public()
  @ApiOperation({ summary: 'Get active hero image (public)' })
  findActive() {
    return this.heroImagesService.findActive();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a hero image by ID' })
  findOne(@Param('id') id: string) {
    return this.heroImagesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a hero image' })
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateHeroImageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const updateData: any = { ...updateDto };

    if (file) {
      const uploadResult = await this.uploadService.uploadFile(file, 'hero');
      updateData.imageUrl = uploadResult.url;
    }

    if (updateDto.startDate) {
      updateData.startDate = new Date(updateDto.startDate);
    }
    if (updateDto.endDate) {
      updateData.endDate = new Date(updateDto.endDate);
    }

    return this.heroImagesService.update(id, updateData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a hero image' })
  remove(@Param('id') id: string) {
    return this.heroImagesService.remove(id);
  }
}

