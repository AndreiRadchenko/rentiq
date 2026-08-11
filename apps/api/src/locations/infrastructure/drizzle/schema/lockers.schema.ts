import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { stations } from './stations.schema';
import { lockerStatus } from '../../../domain/locker-types';

export { lockerStatus };
import type { LockerStatus } from '../../../domain/locker-types';
export type { LockerStatus };

export const lockers = pgTable(
  'lockers',
  {
    id: uuid('id').primaryKey(),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id),
    name: varchar('name', { length: 100 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('AVAILABLE'),
    haLockEntityId: varchar('ha_lock_entity_id', { length: 255 }).notNull(),
    haDoorSensorEntityId: varchar('ha_door_sensor_entity_id', { length: 255 }).notNull(),
    currentRentalId: uuid('current_rental_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    availableIdx: index('idx_lockers_available')
      .on(table.stationId)
      .where(sql`${table.status} = 'AVAILABLE' AND ${table.currentRentalId} IS NULL AND ${table.deletedAt} IS NULL`),
    stationIdx: index('lockers_station_id_idx').on(table.stationId),
  }),
);

export type LockerRow = typeof lockers.$inferSelect;
export type NewLockerRow = typeof lockers.$inferInsert;
