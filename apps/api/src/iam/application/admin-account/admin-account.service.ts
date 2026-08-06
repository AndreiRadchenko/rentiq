import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { ADMIN_ACCOUNT_REPOSITORY, AdminAccountRepository } from '../ports/admin-account.repository';
import { EVENT_BUS, EventBus } from '../../../shared-kernel/application/ports/event-bus';
import { PasswordHasher } from '../../../shared-kernel/infrastructure/crypto/password-hasher';
import { EntityId } from '../../../shared-kernel/domain/value-objects/entity-id';
import { ApiException } from '../../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../../shared-kernel/interface/dto/api-error';
import { AdminAccount, AdminRole } from '../../domain/admin-account';
import { AdminAccountCreated } from '../../infrastructure/events/admin-account-created.event';
import { AdminAccountDisabled } from '../../infrastructure/events/admin-account-disabled.event';

export interface CreateAdminInput {
  orgId: string | null;
  email: string;
  password: string;
  role: AdminRole;
  locale?: string;
}

export interface AdminAccountSummary {
  id: string;
  orgId: string | null;
  role: string;
  email: string;
}

@Injectable()
export class AdminAccountService {
  constructor(
    @Inject(ADMIN_ACCOUNT_REPOSITORY) private readonly adminAccountRepository: AdminAccountRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async createAdmin(input: CreateAdminInput): Promise<AdminAccountSummary> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.adminAccountRepository.findByEmail(email);
    if (existing) {
      throw new ApiException(HttpStatus.CONFLICT, ErrorCode.VALIDATION_ERROR, 'auth.invalid_credentials');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const account = AdminAccount.create({
      id: EntityId.generate().toString(),
      orgId: input.orgId,
      email,
      passwordHash,
      role: input.role,
      locale: input.locale ?? 'uk',
    });

    await this.adminAccountRepository.save(account);
    await this.eventBus.publish(
      new AdminAccountCreated(account.id, account.orgId, account.role),
    );

    return {
      id: account.id,
      orgId: account.orgId,
      role: account.role,
      email: account.email,
    };
  }

  async disable(orgId: string | null, adminAccountId: string): Promise<AdminAccountSummary> {
    const account =
      orgId === null
        ? await this.adminAccountRepository.findById(adminAccountId)
        : await this.adminAccountRepository.findByOrgAndId(orgId, adminAccountId);

    if (!account) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'auth.invalid_credentials');
    }
    if (!account.isActive) {
      return this.toSummary(account);
    }

    if (account.role === 'ORG_ADMIN' && account.orgId !== null) {
      const activeOrgAdmins = await this.adminAccountRepository.countActiveOrgAdmins(account.orgId);
      if (activeOrgAdmins <= 1) {
        throw new ApiException(HttpStatus.CONFLICT, ErrorCode.FORBIDDEN, 'auth.forbidden');
      }
    }

    account.disable();
    await this.adminAccountRepository.save(account);
    await this.eventBus.publish(
      new AdminAccountDisabled(account.id, account.orgId),
    );

    return this.toSummary(account);
  }

  private toSummary(account: AdminAccount): AdminAccountSummary {
    return {
      id: account.id,
      orgId: account.orgId,
      role: account.role,
      email: account.email,
    };
  }
}
