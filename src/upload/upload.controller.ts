import {
  Controller,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('single')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          enum: ['products', 'categories', 'avatars', 'hero', 'general'],
          default: 'general',
        },
      },
    },
  })
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const validFolder = (folder as any) || 'general';
    return this.uploadService.uploadFile(file, validFolder);
  }

  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        folder: {
          type: 'string',
          enum: ['products', 'categories', 'avatars', 'hero', 'general'],
          default: 'general',
        },
      },
    },
  })
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folder') folder?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const validFolder = (folder as any) || 'general';
    return this.uploadService.uploadMultipleFiles(files, validFolder);
  }

  @Post('product')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Upload product image' })
  @ApiConsumes('multipart/form-data')
  async uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.uploadService.uploadFile(file, 'products');
  }

  @Post('category')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Upload category image' })
  @ApiConsumes('multipart/form-data')
  async uploadCategoryImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.uploadService.uploadFile(file, 'categories');
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiConsumes('multipart/form-data')
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.uploadService.uploadFile(file, 'avatars');
  }

  @Post('hero')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Upload hero image' })
  @ApiConsumes('multipart/form-data')
  async uploadHeroImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.uploadService.uploadFile(file, 'hero');
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload logo' })
  @ApiConsumes('multipart/form-data')
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.uploadService.uploadFile(file, 'general');
  }

  @Delete(':path')
  @ApiOperation({ summary: 'Delete a file' })
  async deleteFile(@Param('path') path: string) {
    // Decode the path (it might be URL encoded)
    const decodedPath = decodeURIComponent(path);
    await this.uploadService.deleteFile(decodedPath);
    return { message: 'File deleted successfully' };
  }
}

