CREATE TABLE IF NOT EXISTS "admin_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(16) NOT NULL,
	"assigned_station_ids" text[] NOT NULL,
	"locale" varchar(8) DEFAULT 'uk' NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"recovery_channel" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "admin_accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "renters" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"telegram_id" bigint,
	"phone" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"consent_given_at" timestamp with time zone NOT NULL,
	"consent_version" varchar(32) NOT NULL,
	"locale" varchar(8) DEFAULT 'uk' NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"disable_reason" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"branding" jsonb NOT NULL,
	"payment_creds_ref" jsonb NOT NULL,
	"telegram_config" jsonb NOT NULL,
	"maintenance_window" jsonb,
	"checkbox_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_accounts" ADD CONSTRAINT "admin_accounts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "renters" ADD CONSTRAINT "renters_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
