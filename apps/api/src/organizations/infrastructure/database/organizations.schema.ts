import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  branding: jsonb('branding').notNull(),
  paymentCreds: jsonb('payment_creds').notNull(),
  paymentDetails: jsonb('payment_details').notNull(),
  telegramConfig: jsonb('telegram_config').notNull(),
  maintenanceWindow: jsonb('maintenance_window'),
  checkboxConfig: jsonb('checkbox_config'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type OrganizationRow = typeof organizations.$inferSelect;
export type NewOrganizationRow = typeof organizations.$inferInsert;
