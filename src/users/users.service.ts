import { Injectable, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    // Map isActive to status for frontend compatibility
    return {
      ...user,
      status: user.isActive ? 'active' : 'inactive',
      lastLogin: null,
    };
  }

  async findAll() {
    try {
      // Ensure connection before querying
      const isConnected = await this.prisma.ensureConnected();
      if (!isConnected) {
        throw new Error('Database is temporarily unavailable. Please try again in a moment.');
      }

      const users = await this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Map isActive boolean to status string for frontend compatibility
      return users.map(user => ({
        ...user,
        status: user.isActive ? 'active' : 'inactive',
        lastLogin: null, // User model doesn't have lastLogin field yet
      }));
    } catch (error: any) {
      // Handle database connection errors gracefully
      if (error.code === 'P1001' || error.message?.includes("Can't reach database server")) {
        this.logger.warn('Database connection error in findAll:', error.message);
        throw new Error(
          'Database is temporarily unavailable. The system is attempting to reconnect. Please try again in a moment.'
        );
      }
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      // Ensure connection before querying
      const isConnected = await this.prisma.ensureConnected();
      if (!isConnected) {
        throw new Error('Database is temporarily unavailable. Please try again in a moment.');
      }

      const user = await this.prisma.user.findUnique({
        where: { id },
      });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      // Map to frontend format (same as findAll)
      return {
        ...user,
        status: user.isActive ? 'active' : 'inactive',
        lastLogin: null, // User model doesn't have lastLogin field yet
      };
    } catch (error: any) {
      // Handle database connection errors gracefully
      if (error.code === 'P1001' || error.message?.includes("Can't reach database server")) {
        this.logger.warn('Database connection error in findOne:', error.message);
        throw new Error(
          'Database is temporarily unavailable. The system is attempting to reconnect. Please try again in a moment.'
        );
      }
      // Re-throw other errors (like NotFoundException)
      throw error;
    }
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const data: any = { ...updateUserDto };
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    // Map isActive to status for frontend compatibility
    return {
      ...user,
      status: user.isActive ? 'active' : 'inactive',
      lastLogin: null,
    };
  }

  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.findOne(userId);
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );
    
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return { message: 'Password changed successfully' };
  }
}

