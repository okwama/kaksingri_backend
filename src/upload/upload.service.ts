import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class UploadService {
  private supabase: SupabaseClient;
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Service Key must be configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: 'products' | 'categories' | 'avatars' | 'hero' | 'general' = 'general',
  ): Promise<{ url: string; path: string }> {
    // Validate file
    this.validateFile(file);

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.originalname.split('.').pop();
    const filename = `${timestamp}-${randomString}.${extension}`;
    const filePath = `${folder}/${filename}`;

    // Upload to Supabase Storage
    const { data, error } = await this.supabase.storage
      .from('kaksingri-uploads')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = this.supabase.storage.from('kaksingri-uploads').getPublicUrl(filePath);

    return {
      url: publicUrl,
      path: filePath,
    };
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: 'products' | 'categories' | 'avatars' | 'hero' | 'general' = 'general',
  ): Promise<{ url: string; path: string }[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  async deleteFile(filePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from('kaksingri-uploads')
      .remove([filePath]);

    if (error) {
      throw new BadRequestException(`Failed to delete file: ${error.message}`);
    }
  }

  private validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    // Check file type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }
}

