import { Module, forwardRef } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RENTER_REPOSITORY } from './application/ports/renter.repository';
import { ADMIN_ACCOUNT_REPOSITORY } from './application/ports/admin-account.repository';
import { RenterRepository } from './infrastructure/repositories/renter.repository';
import { AdminAccountRepository } from './infrastructure/repositories/admin-account.repository';
import { RenterService } from './application/renter/renter.service';
import { AdminAccountService } from './application/admin-account/admin-account.service';
import { AuthService } from './application/auth/auth.service';
import { ConsentStatementRegistry } from './application/renter/consent-statement.registry';
import { RenterAnonymizer } from './application/renter/renter-anonymizer';
import { AuthController } from './interface/auth/auth.controller';
import { TelegramExchangeController } from './interface/auth/telegram-exchange.controller';
import { RenterRegisterController } from './interface/renter/renter-register.controller';
import { RenterMeController } from './interface/renter/renter-me.controller';

@Module({
  imports: [forwardRef(() => OrganizationsModule)],
  controllers: [AuthController, TelegramExchangeController, RenterRegisterController, RenterMeController],
  providers: [
    RenterService,
    AdminAccountService,
    AuthService,
    ConsentStatementRegistry,
    { provide: RENTER_REPOSITORY, useClass: RenterRepository },
    { provide: ADMIN_ACCOUNT_REPOSITORY, useClass: AdminAccountRepository },
    {
      provide: RenterAnonymizer,
      useFactory: (renterRepository: RenterRepository) => new RenterAnonymizer(renterRepository),
      inject: [RENTER_REPOSITORY],
    },
  ],
  exports: [RenterService, AdminAccountService, AuthService],
})
export class IamModule {}
