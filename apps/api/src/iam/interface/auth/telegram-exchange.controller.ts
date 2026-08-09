import { Controller, Post, Body, Headers } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { AuthService } from '../../application/auth/auth.service';
import { TelegramExchangeRequest, TelegramExchangeResponse } from './dto/telegram-exchange.dto';
import { ApiException } from '../../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../../shared-kernel/interface/dto/api-error';

@Controller('v1/auth/telegram')
export class TelegramExchangeController {
  constructor(private readonly authService: AuthService) {}

  @Post('exchange')
  async exchange(
    @Body() body: TelegramExchangeRequest,
    @Headers('authorization') authorization?: string,
  ): Promise<TelegramExchangeResponse> {
    const botSecret = this.extractBotSecret(authorization);
    return this.authService.telegramExchange(botSecret, body.telegramId);
  }

  private extractBotSecret(authorization?: string): string {
    if (!authorization || !authorization.startsWith('Bot ')) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.BOT_SECRET_INVALID, 'auth.bot_secret_invalid');
    }
    const secret = authorization.slice('Bot '.length).trim();
    if (!secret) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.BOT_SECRET_INVALID, 'auth.bot_secret_invalid');
    }
    return secret;
  }
}
