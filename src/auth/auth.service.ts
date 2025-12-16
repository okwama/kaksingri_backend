import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../common/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ClientLoginDto } from './dto/client-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }

  async validateToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  // ==================== CLIENT AUTHENTICATION ====================

  async validateClient(email: string, password: string): Promise<any> {
    const client = await this.prisma.client.findUnique({
      where: { email },
    });

    if (!client || !client.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, client.password);
    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = client;
    return result;
  }

  async clientLogin(clientLoginDto: ClientLoginDto) {
    const client = await this.validateClient(clientLoginDto.email, clientLoginDto.password);
    if (!client) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!client.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const payload = { 
      email: client.email, 
      sub: client.id, 
      type: 'client' // Distinguish from admin users
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      client: {
        id: client.id,
        email: client.email,
        name: client.name,
        phone: client.phone,
        loyaltyPointsBalance: client.loyaltyPointsBalance,
        loyaltyTier: client.loyaltyTier,
        referralCode: client.referralCode,
      },
    };
  }
}

