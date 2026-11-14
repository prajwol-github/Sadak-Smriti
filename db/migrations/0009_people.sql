CREATE TYPE "public"."name_visibility" AS ENUM('public', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."person_publication" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."person_road_user" AS ENUM('driver', 'passenger', 'pedestrian', 'rider', 'pillion', 'cyclist');--> statement-breakpoint
CREATE TYPE "public"."person_sex" AS ENUM('female', 'male', 'other');--> statement-breakpoint
CREATE TYPE "public"."person_status" AS ENUM('killed', 'injured', 'uninjured');--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"crash_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"status" "person_status" NOT NULL,
	"name_en" text,
	"name_np" text,
	"age" smallint,
	"sex" "person_sex",
	"road_user" "person_road_user",
	"hometown_text" text,
	"name_visibility" "name_visibility" DEFAULT 'public' NOT NULL,
	"publication" "person_publication" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "persons_slug_unique" UNIQUE("slug"),
	CONSTRAINT "persons_age_range" CHECK ("persons"."age" is null or "persons"."age" between 0 and 120),
	CONSTRAINT "persons_has_name" CHECK ("persons"."name_en" is not null or "persons"."name_np" is not null)
);
--> statement-breakpoint
ALTER TABLE "revisions" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_crash_id_crashes_id_fk" FOREIGN KEY ("crash_id") REFERENCES "public"."crashes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "persons_crash_idx" ON "persons" USING btree ("crash_id");--> statement-breakpoint
-- History is a record: the website may add and read revisions, never change or remove one (like
-- audit_log). Exports and the public API read names only through reviewed views built later, so the
-- read-only role gets no access to the raw table.
REVOKE UPDATE, DELETE, TRUNCATE ON "revisions" FROM app;--> statement-breakpoint
REVOKE SELECT ON "persons" FROM readonly;
