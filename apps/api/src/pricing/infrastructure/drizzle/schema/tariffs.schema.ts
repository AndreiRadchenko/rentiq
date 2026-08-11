import { pgTable, uuid, varchar, integer, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from '../../../../organizations/infrastructure/database/organizations.schema';
import { dayTypeValues } from '../../../domain/day-type';

export { dayTypeValues };
import type { DayType } from '../../../domain/day-type';
export type { DayType };

export const tariffs = pgTable(
  'tariffs',
  {
    id: uuid('id').primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    kitType: varchar('kit_type', { length: 100 }).notNull(),
    dayType: varchar('day_type', { length: 10 }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    priceMinor: integer('price_minor').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('UAH'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    lookupIdx: index('idx_tariffs_lookup').on(
      table.orgId,
      table.kitType,
      table.dayType,
      table.durationMinutes,
    ),
    uniqueKey: uniqueIndex('tariffs_unique_key')
      .on(table.orgId, table.kitType, table.dayType, table.durationMinutes)
      .where(sql`${table.deletedAt} IS NULL`),
    durationCheck: check('tariffs_duration_minutes_check', sql`${table.durationMinutes} > 0`),
    priceCheck: check('tariffs_price_minor_check', sql`${table.priceMinor} >= 0`),
  }),
);

export type TariffRow = typeof tariffs.$inferSelect;
export type NewTariffRow = typeof tariffs.$inferInsert;
