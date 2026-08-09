import { pgTable, uuid, varchar, bigint, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { organizations } from '../../../organizations/infrastructure/database/organizations.schema';

export const renters = pgTable(
  'renters',
  {
    id: uuid('id').primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    telegramId: bigint('telegram_id', { mode: 'number' }),
    phone: varchar('phone', { length: 20 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    consentGivenAt: timestamp('consent_given_at', { withTimezone: true }).notNull(),
    consentVersion: varchar('consent_version', { length: 32 }).notNull(),
    locale: varchar('locale', { length: 8 }).notNull().default('uk'),
    status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
    disableReason: varchar('disable_reason', { length: 16 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    indexes: [
      uniqueIndex('renters_telegram_id_idx').on(table.telegramId),
      uniqueIndex('renters_org_phone_idx').on(table.orgId, table.phone),
      index('renters_org_id_idx').on(table.orgId),
    ],
  }),
);

export type RenterRow = typeof renters.$inferSelect;
export type NewRenterRow = typeof renters.$inferInsert;
