import { Module, forwardRef, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { ORGANIZATION_REPOSITORY } from './application/ports/organization.repository';
import { OrganizationRepository } from './infrastructure/repositories/organization.repository';
import { OrganizationService } from './application/organization.service';
import { OrganizationsController } from './interface/organizations.controller';
import { ImpersonationMiddleware } from './infrastructure/middleware/impersonation.middleware';

@Module({
  imports: [forwardRef(() => IamModule)],
  controllers: [OrganizationsController],
  providers: [
    OrganizationService,
    { provide: ORGANIZATION_REPOSITORY, useClass: OrganizationRepository },
  ],
  exports: [OrganizationService, ORGANIZATION_REPOSITORY],
})
export class OrganizationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ImpersonationMiddleware).forRoutes('*');
  }
}
