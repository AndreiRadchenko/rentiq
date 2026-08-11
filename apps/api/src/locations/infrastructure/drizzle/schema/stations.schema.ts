import { pgTable, uuid, varchar, text, boolean, integer, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from '../../../../organizations/infrastructure/database/organizations.schema';
import { stationWorkingStatus, stationHealthStatus } from '../../../domain/station-types';

export { stationWorkingStatus, stationHealthStatus };
import type { StationWorkingStatus, StationHealthStatus } from '../../../domain/station-types';
export type { StationWorkingStatus, StationHealthStatus };

export const stations = pgTable(
  'stations',
  {
    id: uuid('id').primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    name: varchar('name', { length: 255 }).notNull(),
    address: varchar('address', { length: 1000 }),
    workingStatus: varchar('working_status', { length: 16 }).notNull().default('WORKING'),
    isActive: boolean('is_active').notNull().default(true),
    adminIntendedIsActive: boolean('admin_intended_is_active').notNull().default(true),
    isVisibleToClients: boolean('is_visible_to_clients').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    haUrlOrIp: varchar('ha_url_or_ip', { length: 255 }).notNull(),
    haTokenEncrypted: text('ha_token_encrypted').notNull(),
    haWebhookSecretEncrypted: text('ha_webhook_secret_encrypted').notNull(),
    autoLockDelaySec: integer('auto_lock_delay_sec').notNull().default(30),
    healthStatus: varchar('health_status', { length: 16 }).notNull().default('UNKNOWN'),
    lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    bookableIdx: index('idx_stations_bookable')
      .on(table.orgId, table.isActive, table.isVisibleToClients, table.sortOrder)
      .where(sql`${table.workingStatus} = 'WORKING' AND ${table.deletedAt} IS NULL`),
    orgIdx: index('stations_org_id_idx').on(table.orgId),
    autoLockCheck: check('stations_auto_lock_delay_sec_check', sql`${table.autoLockDelaySec} > 0`),
  }),
);

export type StationRow = typeof stations.$inferSelect;
export type NewStationRow = typeof stations.$inferInsert;
