import { index, jsonb, numeric, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const celestialObjects = pgTable(
  "celestial_objects",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 256 }).notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    catalogId: varchar("catalog_id", { length: 64 }),
    ra: numeric("ra", { precision: 9, scale: 4 }).notNull(),
    dec: numeric("dec", { precision: 9, scale: 4 }).notNull(),
    distance: numeric("distance", { precision: 12, scale: 2 }).notNull(),
    magnitude: numeric("magnitude", { precision: 6, scale: 2 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    description: varchar("description", { length: 2048 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    raIdx: index("celestial_ra_idx").on(table.ra),
    decIdx: index("celestial_dec_idx").on(table.dec),
    distanceIdx: index("celestial_distance_idx").on(table.distance),
  }),
);

export const userProfiles = pgTable("user_profiles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().default({}),
  lastPosition: jsonb("last_position")
    .$type<{ x: number; y: number; z: number }>()
    .default({ x: 0, y: 0, z: 0 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});
