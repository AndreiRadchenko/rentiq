import { Controller, Post, Body } from '@nestjs/common';
import { RenterService } from '../../application/renter/renter.service';
import { RegisterRenterRequest, RegisterRenterResponse } from './dto/register-renter.dto';

@Controller('v1/renters')
export class RenterRegisterController {
  constructor(private readonly renterService: RenterService) {}

  @Post('register')
  async register(@Body() body: RegisterRenterRequest): Promise<RegisterRenterResponse> {
    const result = await this.renterService.register({
      name: body.name,
      phone: body.phone,
      consentGiven: body.consentGiven,
      consentVersion: body.consentVersion,
      locale: body.locale ?? 'uk',
      telegramId: body.telegramId,
    });

    return {
      renter: this.renterService.toProfile(result.renter),
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      alreadyRegistered: result.alreadyRegistered,
    };
  }
}
