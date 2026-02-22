import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { AdapterFactory } from '../adapters/factory/adapter.factory';

/**
 * Auth Service
 * Handles wallet authentication using adapter abstraction.
 * Now decoupled from Stellar SDK - uses IWalletAdapter instead.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly adapterFactory: AdapterFactory,
  ) {}

  /**
   * Validate wallet signature using adapter
   * @param loginDto Login credentials with wallet signature
   * @returns Wallet info if valid
   */
  async validateWallet(loginDto: LoginDto) {
    const { publicKey, message, signature } = loginDto;

    try {
      // Execute wallet operation with protection (circuit breaker)
      const isValid = await this.adapterFactory.executeWalletOperationWithProtection(
        async (walletAdapter) => {
          // Validate address format first
          if (!walletAdapter.validateAddress(publicKey)) {
            throw new UnauthorizedException('Invalid wallet address format');
          }

          // Verify signature using adapter
          return await walletAdapter.verifySignature(publicKey, message, signature);
        },
      );

      if (!isValid) {
        this.logger.warn(`Invalid signature provided by wallet: ${publicKey}`);
        throw new UnauthorizedException('Invalid signature');
      }

      // Check for replay attacks (Optional: verify timestamp in message)
      // const timestamp = parseInt(message.split(':')[1]);
      // if (Date.now() - timestamp > 60000) throw new UnauthorizedException('Request expired');

      // TODO: Find or Create User in DB here
      // const user = await this.usersService.findOrCreate(publicKey);

      this.logger.log(`Wallet authenticated successfully: ${publicKey}`);
      return { publicKey };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Authentication failed: ${error.message}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Generate JWT token for authenticated wallet
   * @param user User object with publicKey
   * @returns JWT token
   */
  async login(user: any) {
    const payload = { publicKey: user.publicKey, sub: user.publicKey };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
