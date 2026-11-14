CREATE TYPE "public"."local_unit_type" AS ENUM('metro', 'sub_metro', 'municipality', 'rural');--> statement-breakpoint
CREATE TABLE "districts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"province_id" uuid NOT NULL,
	"code" smallint NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_np" text NOT NULL,
	"geom" geometry(MultiPolygon, 4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "districts_code_unique" UNIQUE("code"),
	CONSTRAINT "districts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "local_units" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"district_id" uuid NOT NULL,
	"code" smallint NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_np" text NOT NULL,
	"type" "local_unit_type" NOT NULL,
	"wards" integer NOT NULL,
	"geom" geometry(MultiPolygon, 4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_units_code_unique" UNIQUE("code"),
	CONSTRAINT "local_units_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"code" smallint NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_np" text NOT NULL,
	"geom" geometry(MultiPolygon, 4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provinces_code_unique" UNIQUE("code"),
	CONSTRAINT "provinces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "districts" ADD CONSTRAINT "districts_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_units" ADD CONSTRAINT "local_units_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "districts_geom_gist" ON "districts" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "districts_province_idx" ON "districts" USING btree ("province_id");--> statement-breakpoint
CREATE INDEX "local_units_geom_gist" ON "local_units" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "local_units_district_idx" ON "local_units" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "provinces_geom_gist" ON "provinces" USING gist ("geom");