import { pgTable, uuid, varchar, jsonb, timestamp, text, index } from 'drizzle-orm/pg-core';
import { organizations } from '../../../organizations/infrastructure/database/organizations.schema';

export const adminAccounts = pgTable(
  'admin_accounts',
  {
    id: uuid('id').primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id),
    email: varchar('email', { length: 320 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 16 }).notNull(),
    assignedStationIds: text('assigned_station_ids')
      .array()
      .notNull()
      .$defaultFn(() => []),
    locale: varchar('locale', { length: 8 }).notNull().default('uk'),
    status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
    recoveryChannel: jsonb('recovery_channel'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    indexes: [index('admin_accounts_org_id_idx').on(table.orgId)],
  }),
);

export type AdminAccountRow = typeof adminAccounts.$inferSelect;
export type NewAdminAccountRow = typeof adminAccounts.$inferInsert;
