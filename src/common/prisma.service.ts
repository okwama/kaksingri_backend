import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval: NodeJS.Timeout | null = null;

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // Only log errors and warnings, not detailed query logs
    this.$on('error' as never, (e: any) => {
      this.logger.error('Prisma error:', e);
      // If connection is lost, attempt to reconnect
      if (e.code === 'P1001' && this.isConnected) {
        this.isConnected = false;
        this.attemptReconnect();
      }
    });

    this.$on('warn' as never, (e: any) => {
      this.logger.warn('Prisma warning:', e);
    });
  }

  async onModuleInit() {
    // Don't block startup - attempt connection in background
    this.connectWithRetry().catch((error) => {
      this.logger.warn(
        'Database connection failed on startup. Application will continue, but database operations may fail. Retrying in background...'
      );
      this.attemptReconnect();
    });
  }

  async onModuleDestroy() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    try {
      await this.$disconnect();
      this.logger.log('Database disconnected successfully');
    } catch (error) {
      this.logger.error('Error disconnecting from database:', error);
    }
  }

  private async connectWithRetry(attempt = 1): Promise<void> {
    try {
      await Promise.race([
        this.$connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        ),
      ]);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.logger.log('Database connected successfully');
    } catch (error: any) {
      if (attempt < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
        this.logger.warn(
          `Database connection attempt ${attempt}/${this.maxReconnectAttempts} failed. Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.connectWithRetry(attempt + 1);
      } else {
        this.logger.error(
          `Failed to connect to database after ${this.maxReconnectAttempts} attempts. Will retry in background.`
        );
        throw error;
      }
    }
  }

  private attemptReconnect() {
    if (this.reconnectInterval) {
      return; // Already attempting to reconnect
    }

    this.reconnectInterval = setInterval(async () => {
      if (this.isConnected) {
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
        return;
      }

      try {
        await this.connectWithRetry();
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      } catch (error) {
        this.logger.debug('Background reconnection attempt failed. Will retry...');
      }
    }, 30000); // Retry every 30 seconds
  }

  async ensureConnected(): Promise<boolean> {
    if (this.isConnected) {
      try {
        // Quick health check
        await this.$queryRaw`SELECT 1`;
        return true;
      } catch (error) {
        this.isConnected = false;
        this.attemptReconnect();
        return false;
      }
    }

    try {
      await this.connectWithRetry();
      return true;
    } catch (error) {
      this.attemptReconnect();
      return false;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

