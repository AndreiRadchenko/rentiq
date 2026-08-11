-- Rename payment_creds_ref → payment_creds on organizations (existing table from 0000)
ALTER TABLE "organizations" RENAME COLUMN "payment_creds_ref" TO "payment_creds";
--> statement-breakpoint
-- Add payment_details column (plaintext business data: payer name, IBAN, EDRPOU, purpose)
ALTER TABLE "organizations" ADD COLUMN "payment_details" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
-- Create stations table (ha_token_encrypted + ha_webhook_secret_encrypted instead of ha_token_ref)
CREATE TABLE IF NOT EXISTS "stations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" varchar(1000),
	"working_status" varchar(16) DEFAULT 'WORKING' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"admin_intended_is_active" boolean DEFAULT true NOT NULL,
	"is_visible_to_clients" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"ha_url_or_ip" varchar(255) NOT NULL,
	"ha_token_encrypted" text NOT NULL,
	"ha_webhook_secret_encrypted" text NOT NULL,
	"auto_lock_delay_sec" integer DEFAULT 30 NOT NULL,
	"health_status" varchar(16) DEFAULT 'UNKNOWN' NOT NULL,
	"last_health_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "stations_auto_lock_delay_sec_check" CHECK ("auto_lock_delay_sec" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lockers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"station_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'AVAILABLE' NOT NULL,
	"ha_lock_entity_id" varchar(255) NOT NULL,
	"ha_door_sensor_entity_id" varchar(255) NOT NULL,
	"current_rental_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_kits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"station_id" uuid NOT NULL,
	"locker_id" uuid,
	"name" varchar(255) NOT NULL,
	"kit_type" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tariffs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"kit_type" varchar(100) NOT NULL,
	"day_type" varchar(10) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'UAH' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tariffs_duration_minutes_check" CHECK ("duration_minutes" > 0),
	CONSTRAINT "tariffs_price_minor_check" CHECK ("price_minor" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_kits_station_id_idx" ON "inventory_kits" ("station_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_kits_locker_id_idx" ON "inventory_kits" ("locker_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lockers_available" ON "lockers" ("station_id") WHERE ("status" = 'AVAILABLE' AND "current_rental_id" IS NULL AND "deleted_at" IS NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lockers_station_id_idx" ON "lockers" ("station_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stations_bookable" ON "stations" ("org_id","is_active","is_visible_to_clients","sort_order") WHERE ("working_status" = 'WORKING' AND "deleted_at" IS NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stations_org_id_idx" ON "stations" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tariffs_lookup" ON "tariffs" ("org_id","kit_type","day_type","duration_minutes") WHERE ("deleted_at" IS NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tariffs_unique_key" ON "tariffs" ("org_id","kit_type","day_type","duration_minutes") WHERE ("deleted_at" IS NULL);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_kits" ADD CONSTRAINT "inventory_kits_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_kits" ADD CONSTRAINT "inventory_kits_locker_id_lockers_id_fk" FOREIGN KEY ("locker_id") REFERENCES "lockers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lockers" ADD CONSTRAINT "lockers_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stations" ADD CONSTRAINT "stations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
