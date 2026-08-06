import { Renter } from '../../../src/iam/domain/renter';
import { AdminAccount, AdminAccountState } from '../../../src/iam/domain/admin-account';
import { Organization } from '../../../src/organizations/domain/organization';
import { RenterRepository } from '../../../src/iam/application/ports/renter.repository';
import { AdminAccountRepository } from '../../../src/iam/application/ports/admin-account.repository';
import { OrganizationRepository } from '../../../src/organizations/application/ports/organization.repository';
import { EventBus } from '../../../src/shared-kernel/application/ports/event-bus';
import { DomainEvent } from '../../../src/shared-kernel/domain/events/domain-event';
import { JwtTokenService } from '../../../src/shared-kernel/infrastructure/jwt/jwt-token.service';

export class FakeRenterRepository implements RenterRepository {
  store = new Map<string, Renter>();

  async findById(orgId: string, id: string): Promise<Renter | null> {
    return this.store.get(`${orgId}:${id}`) ?? null;
  }

  async findByOrgAndPhone(orgId: string, phone: string): Promise<Renter | null> {
    for (const renter of this.store.values()) {
      const state = renter.currentState;
      if (state.orgId === orgId && state.phone === phone) {
        return renter;
      }
    }
    return null;
  }

  async findByOrgAndTelegramId(orgId: string, telegramId: number): Promise<Renter | null> {
    for (const renter of this.store.values()) {
      const state = renter.currentState;
      if (state.orgId === orgId && state.telegramId === telegramId) {
        return renter;
      }
    }
    return null;
  }

  async save(renter: Renter): Promise<void> {
    this.store.set(`${renter.currentState.orgId}:${renter.id}`, renter);
  }

  async anonymize(targetId: string, orgId: string, anonymousName: string, anonymousPhone: string): Promise<void> {
    const renter = await this.findById(orgId, targetId);
    if (!renter) {
      return;
    }
    renter.anonymize(anonymousName, anonymousPhone);
    await this.save(renter);
  }
}

export class FakeAdminAccountRepository implements AdminAccountRepository {
  store = new Map<string, AdminAccount>();

  async findByEmail(email: string): Promise<AdminAccount | null> {
    for (const account of this.store.values()) {
      if (account.email.toLowerCase() === email.toLowerCase()) {
        return account;
      }
    }
    return null;
  }

  async findById(id: string): Promise<AdminAccount | null> {
    return this.store.get(id) ?? null;
  }

  async findByOrgAndId(orgId: string, id: string): Promise<AdminAccount | null> {
    const account = this.store.get(id);
    return account && account.orgId === orgId ? account : null;
  }

  async countActiveOrgAdmins(orgId: string): Promise<number> {
    let count = 0;
    for (const account of this.store.values()) {
      const state = account.currentState;
      if (state.orgId === orgId && state.role === 'ORG_ADMIN' && state.status === 'ACTIVE') {
        count += 1;
      }
    }
    return count;
  }

  async save(account: AdminAccount): Promise<void> {
    this.store.set(account.id, account);
  }
}

export class FakeOrganizationRepository implements OrganizationRepository {
  store = new Map<string, Organization>();

  async findById(id: string): Promise<Organization | null> {
    return this.store.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    for (const organization of this.store.values()) {
      if (organization.slug === slug) {
        return organization;
      }
    }
    return null;
  }

  async listAll(): Promise<Organization[]> {
    return Array.from(this.store.values());
  }

  async save(organization: Organization): Promise<void> {
    this.store.set(organization.id, organization);
  }
}

export class FakeEventBus implements EventBus {
  events: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }

  subscribe(_eventType: string): void {
    // no-op
  }
}

export class FakeJwtTokenService {
  accessTtlSeconds = 900;

  signAccessToken = jest.fn((input: { sub: string; orgId: string | null; locale: string; type: string }) => {
    return `access:${input.type}:${input.sub}`;
  });

  signRefreshToken = jest.fn((input: { sub: string; orgId: string | null; locale: string; subjectType: string }) => {
    return `refresh:${input.subjectType}:${input.sub}`;
  });

  verify = jest.fn(() => {
    throw new Error('FakeJwtTokenService.verify not implemented');
  });
}

export class FakePasswordHasher {
  async hash(plaintext: string): Promise<string> {
    return `hashed:${plaintext}`;
  }

  async verify(plaintext: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plaintext}`;
  }
}

export function makeOrganization(
  slug = 'rentiq',
  name = 'rentiq-dev',
  supportedLocales = ['uk', 'en'],
  defaultLocale = 'uk',
): Organization {
  return Organization.create({
    id: `00000000-0000-4000-8000-${slug.replace(/-/g, '').padEnd(12, '0')}`,
    name,
    slug,
    branding: {
      logoUrl: null,
      primaryColor: null,
      businessName: name,
      supportedLocales,
      defaultLocale,
    },
    paymentCredsRef: { gateway: '', secretRef: '', enabled: false },
    telegramConfig: { botSecretHash: 'hashed:secret', botUsername: 'bot' },
    maintenanceWindow: null,
    checkboxConfig: null,
  });
}

export function makeAdminAccount(
  overrides: Partial<AdminAccountState> = {},
): AdminAccount {
  return AdminAccount.create({
    id: overrides.id ?? '10000000-0000-4000-8000-000000000001',
    orgId: overrides.orgId === undefined ? '20000000-0000-4000-8000-000000000002' : overrides.orgId,
    email: overrides.email ?? 'admin@rentiq.dev',
    passwordHash: overrides.passwordHash ?? 'hashed:change-me',
    role: overrides.role ?? 'ORG_ADMIN',
    locale: overrides.locale ?? 'uk',
  });
}

export function asJwtService(fake: FakeJwtTokenService): JwtTokenService {
  return fake as unknown as JwtTokenService;
}
