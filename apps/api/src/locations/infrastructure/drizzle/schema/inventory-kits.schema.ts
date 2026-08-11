import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { stations } from './stations.schema';
import { lockers } from './lockers.schema';

export const inventoryKits = pgTable(
  'inventory_kits',
  {
    id: uuid('id').primaryKey(),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id),
    lockerId: uuid('locker_id').references(() => lockers.id),
    name: varchar('name', { length: 255 }).notNull(),
    kitType: varchar('kit_type', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    stationIdx: index('inventory_kits_station_id_idx').on(table.stationId),
    lockerIdx: index('inventory_kits_locker_id_idx').on(table.lockerId),
    lockerUniqueIdx: uniqueIndex('inventory_kits_locker_id_unique')
      .on(table.lockerId)
      .where(sql`${table.lockerId} IS NOT NULL`),
  }),
);

export type InventoryKitRow = typeof inventoryKits.$inferSelect;
export type NewInventoryKitRow = typeof inventoryKits.$inferInsert;
