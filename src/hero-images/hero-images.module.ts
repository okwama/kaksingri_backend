import { Module } from '@nestjs/common';
import { HeroImagesService } from './hero-images.service';
import { HeroImagesController } from './hero-images.controller';
import { CommonModule } from '../common/common.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [CommonModule, UploadModule],
  controllers: [HeroImagesController],
  providers: [HeroImagesService],
  exports: [HeroImagesService],
})
export class HeroImagesModule {}

