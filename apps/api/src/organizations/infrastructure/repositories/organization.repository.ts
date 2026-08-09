import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../../../shared-kernel/infrastructure/database/connection';
import { organizations } from '../database/organizations.schema';
import { Organization, OrganizationState } from '../../domain/organization';
import { OrganizationRepository as OrganizationRepositoryPort } from '../../application/ports/organization.repository';

@Injectable()
export class OrganizationRepository implements OrganizationRepositoryPort {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

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
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status as OrganizationState['status'],
      branding: row.branding as OrganizationState['branding'],
      paymentCredsRef: row.paymentCredsRef as OrganizationState['paymentCredsRef'],
      telegramConfig: row.telegramConfig as OrganizationState['telegramConfig'],
      maintenanceWindow: row.maintenanceWindow as OrganizationState['maintenanceWindow'],
      checkboxConfig: row.checkboxConfig as OrganizationState['checkboxConfig'],
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
      paymentCredsRef: state.paymentCredsRef,
      telegramConfig: state.telegramConfig,
      maintenanceWindow: state.maintenanceWindow,
      checkboxConfig: state.checkboxConfig,
      deletedAt: state.deletedAt,
    };
  }
}
