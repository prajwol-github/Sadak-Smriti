CREATE TYPE "public"."crash_source_relation" AS ENUM('report', 'follow_up', 'roundup', 'other');--> statement-breakpoint
CREATE TYPE "public"."crash_status" AS ENUM('draft', 'pending', 'published', 'rejected', 'merged');--> statement-breakpoint
CREATE TYPE "public"."created_via" AS ENUM('news', 'contributor', 'tip', 'import');--> statement-breakpoint
CREATE TYPE "public"."location_precision" AS ENUM('exact', 'place', 'local_unit', 'district');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('news', 'police', 'social', 'witness', 'other');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('bus', 'microbus', 'jeep', 'car', 'truck', 'tipper', 'tanker', 'tractor', 'motorcycle', 'scooter', 'e_rickshaw', 'bicycle', 'other');--> statement-breakpoint
CREATE TYPE "public"."verification_level" AS ENUM('single_source', 'multi_source', 'reviewer_verified', 'family_confirmed', 'police_matched');--> statement-breakpoint
CREATE TYPE "public"."submission_kind" AS ENUM('new_crash', 'edit_crash', 'add_source', 'remove_source', 'new_person', 'edit_person', 'memorial_edit', 'add_media', 'add_link', 'tribute', 'tip', 'merge_crashes', 'merge_people', 'split_crash', 'split_person', 'hide_name', 'hide_memorial', 'delete', 'family_claim');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected', 'changes_requested', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."submission_via" AS ENUM('web', 'tip', 'pipeline');--> statement-breakpoint
CREATE TABLE "crash_sources" (
	"crash_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"relation" "crash_source_relation" DEFAULT 'report' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crash_sources_crash_id_source_id_pk" PRIMARY KEY("crash_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "crash_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"crash_id" uuid NOT NULL,
	"type" "vehicle_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crashes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"status" "crash_status" DEFAULT 'draft' NOT NULL,
	"merged_into_id" uuid,
	"title_en" text,
	"title_np" text,
	"occurred_on" date NOT NULL,
	"occurred_time" time,
	"location" geography(Point, 4326),
	"location_precision" "location_precision" DEFAULT 'district' NOT NULL,
	"place_name_en" text,
	"place_name_np" text,
	"province_id" uuid NOT NULL,
	"district_id" uuid NOT NULL,
	"local_unit_id" uuid,
	"deaths" integer NOT NULL,
	"injured_total" integer,
	"created_via" "created_via" NOT NULL,
	"verification_level" "verification_level" DEFAULT 'single_source' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crashes_slug_unique" UNIQUE("slug"),
	CONSTRAINT "crashes_deaths_nonnegative" CHECK ("crashes"."deaths" >= 0),
	CONSTRAINT "crashes_injured_nonnegative" CHECK ("crashes"."injured_total" is null or "crashes"."injured_total" >= 0),
	CONSTRAINT "crashes_not_future" CHECK ("crashes"."occurred_on" <= (now() at time zone 'Asia/Kathmandu')::date)
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"kind" "source_kind" NOT NULL,
	"url" text,
	"normalized_url" text,
	"title" text,
	"text_private" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_normalized_url_unique" UNIQUE("normalized_url")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"ip_hash" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "revisions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"submission_id" uuid,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"kind" "submission_kind" NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"payload" jsonb NOT NULL,
	"via" "submission_via" NOT NULL,
	"submitted_by" uuid,
	"ip_hash" text,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"required_approvals" smallint DEFAULT 1 NOT NULL,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"contact_encrypted" text,
	"contact_purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_required_approvals_range" CHECK ("submissions"."required_approvals" between 1 and 2)
);
--> statement-breakpoint
ALTER TABLE "crash_sources" ADD CONSTRAINT "crash_sources_crash_id_crashes_id_fk" FOREIGN KEY ("crash_id") REFERENCES "public"."crashes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crash_sources" ADD CONSTRAINT "crash_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crash_vehicles" ADD CONSTRAINT "crash_vehicles_crash_id_crashes_id_fk" FOREIGN KEY ("crash_id") REFERENCES "public"."crashes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crashes" ADD CONSTRAINT "crashes_merged_into_id_crashes_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."crashes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crashes" ADD CONSTRAINT "crashes_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crashes" ADD CONSTRAINT "crashes_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crashes" ADD CONSTRAINT "crashes_local_unit_id_local_units_id_fk" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crash_vehicles_crash_idx" ON "crash_vehicles" USING btree ("crash_id");--> statement-breakpoint
CREATE INDEX "crashes_district_date_idx" ON "crashes" USING btree ("district_id","occurred_on");--> statement-breakpoint
CREATE INDEX "crashes_location_gist" ON "crashes" USING gist ("location");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "revisions_entity_idx" ON "revisions" USING btree ("entity_type","entity_id","version");--> statement-breakpoint
CREATE INDEX "submissions_status_created_idx" ON "submissions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "submissions_target_idx" ON "submissions" USING btree ("target_type","target_id");