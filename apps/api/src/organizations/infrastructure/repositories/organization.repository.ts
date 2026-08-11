import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../../../shared-kernel/infrastructure/database/connection';
import { CryptoService } from '../../../shared-kernel/infrastructure/crypto/crypto.service';
import { organizations } from '../database/organizations.schema';
import {
  Organization,
  OrganizationState,
  PaymentCreds,
  PaymentDetails,
  CheckboxConfig,
} from '../../domain/organization';
import { OrganizationRepository as OrganizationRepositoryPort } from '../../application/ports/organization.repository';

const DEFAULT_PAYMENT_CREDS: PaymentCreds = {
  mode: 'test',
  testTokenEncrypted: '',
  liveTokenEncrypted: '',
  redirectUrl: '',
  enabled: false,
};

const DEFAULT_PAYMENT_DETAILS: PaymentDetails = {
  payerName: '',
  iban: '',
  edrpou: '',
  purpose: '',
};

const DEFAULT_CHECKBOX_CONFIG: CheckboxConfig = {
  mode: 'test',
  licenseKeyEncrypted: '',
  testTokenEncrypted: '',
  liveTokenEncrypted: '',
  enabled: false,
};

@Injectable()
export class OrganizationRepository implements OrganizationRepositoryPort {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly crypto: CryptoService,
  ) {}

  async findById(id: string): Promise<Organization | null> {
    const rows = await this.db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return rows[0] ? Organization.reconstitute(this.mapRow(rows[0])) : null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const rows = await this.db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    return rows[0] ? Organization.reconstitute(this.mapRow(rows[0])) : null;
  }

  async listAll(): Promise<Organization[]> {
    const rows = await this.db.select().from(organizations);
    return rows.map((row) => Organization.reconstitute(this.mapRow(row)));
  }

  async save(organization: Organization): Promise<void> {
    const state = organization.currentState;
    const row = this.mapState(state);
    const existing = await this.db.select().from(organizations).where(eq(organizations.id, row.id)).limit(1);
    if (existing[0]) {
      await this.db.update(organizations).set(row).where(eq(organizations.id, row.id));
    } else {
      await this.db.insert(organizations).values(row);
    }
  }

  private mapRow(row: typeof organizations.$inferSelect): OrganizationState {
    const paymentCreds = (row.paymentCreds ?? {}) as Partial<PaymentCreds>;
    const checkboxConfig = (row.checkboxConfig ?? null) as Partial<CheckboxConfig> | null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status as OrganizationState['status'],
      branding: row.branding as OrganizationState['branding'],
      paymentCreds: { ...DEFAULT_PAYMENT_CREDS, ...paymentCreds },
      paymentDetails: (row.paymentDetails ?? DEFAULT_PAYMENT_DETAILS) as PaymentDetails,
      telegramConfig: row.telegramConfig as OrganizationState['telegramConfig'],
      maintenanceWindow: row.maintenanceWindow as OrganizationState['maintenanceWindow'],
      checkboxConfig: checkboxConfig ? { ...DEFAULT_CHECKBOX_CONFIG, ...checkboxConfig } : null,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
    };
  }

  private mapState(state: OrganizationState): typeof organizations.$inferInsert {
    return {
      id: state.id,
      name: state.name,
      slug: state.slug,
      status: state.status,
      branding: state.branding,
      paymentCreds: state.paymentCreds,
      paymentDetails: state.paymentDetails,
      telegramConfig: state.telegramConfig,
      maintenanceWindow: state.maintenanceWindow,
      checkboxConfig: state.checkboxConfig,
      deletedAt: state.deletedAt,
    };
  }
}
