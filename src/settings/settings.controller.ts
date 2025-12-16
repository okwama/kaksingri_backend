import { Controller, Get, Post, Put, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new setting' })
  create(@Body() createSettingDto: CreateSettingDto) {
    return this.settingsService.create(createSettingDto);
  }

  @Get('theme-settings')
  @Public()
  @ApiOperation({ summary: 'Get theme settings (public)' })
  async getThemeSettings() {
    return this.settingsService.getThemeSettings();
  }

  @Get('hero-image')
  @Public()
  @ApiOperation({ summary: 'Get active hero image (public)' })
  async getHeroImage() {
    // Get hero image from settings or return default
    try {
      const heroSetting = await this.settingsService.findOne('hero_image');
      if (heroSetting && heroSetting.value) {
        return heroSetting.value;
      }
    } catch (error) {
      // Setting doesn't exist, return default
    }
    
    // Return default hero image
    return {
      imageUrl: '',
      title: 'Born by the Lake, Crafted by Hand',
      subtitle: 'Lake Victoria Heritage',
      ctaText: 'Explore Collection',
      ctaLink: '/catalogue',
      isActive: true,
      priority: 1,
    };
  }

  @Patch('theme-settings')
  @ApiOperation({ summary: 'Update theme settings' })
  async updateThemeSettings(@Body() themeData: any) {
    return this.settingsService.updateThemeSettings(themeData);
  }

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  findAll() {
    return this.settingsService.findAll();
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk update settings' })
  async bulkUpdate(@Body() settingsData: Record<string, any>) {
    return this.settingsService.bulkUpdate(settingsData);
  }

  @Put()
  @ApiOperation({ summary: 'Bulk update settings (alias for POST /bulk)' })
  async bulkUpdatePut(@Body() settingsData: Record<string, any>) {
    return this.settingsService.bulkUpdate(settingsData);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get setting by key' })
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update setting' })
  update(@Param('key') key: string, @Body() updateSettingDto: UpdateSettingDto) {
    return this.settingsService.update(key, updateSettingDto);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete setting' })
  remove(@Param('key') key: string) {
    return this.settingsService.remove(key);
  }
}

