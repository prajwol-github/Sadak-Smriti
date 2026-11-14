CREATE TYPE "public"."rejection_reason" AS ENUM('duplicate', 'no_source', 'wrong_info', 'abuse', 'graphic', 'off_topic');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('approve', 'reject', 'request_changes');--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"submission_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"decision" "review_decision" NOT NULL,
	"reason_code" "rejection_reason",
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_reject_has_reason" CHECK ("reviews"."decision" <> 'reject' or "reviews"."reason_code" is not null)
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_one_per_reviewer" ON "reviews" USING btree ("submission_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "reviews_submission_idx" ON "reviews" USING btree ("submission_id");--> statement-breakpoint
-- A reviewer's decision is a record, not a draft: the website may add and read reviews, never change or
-- remove one (like audit_log). Exports and the public API never read them.
REVOKE UPDATE, DELETE, TRUNCATE ON "reviews" FROM app;--> statement-breakpoint
REVOKE SELECT ON "reviews" FROM readonly;
