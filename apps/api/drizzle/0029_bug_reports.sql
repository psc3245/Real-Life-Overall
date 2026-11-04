CREATE TYPE "public"."bug_report_platform" AS ENUM('web', 'ios');--> statement-breakpoint
CREATE TYPE "public"."bug_report_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TABLE "bug_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"page" text DEFAULT '' NOT NULL,
	"platform" "bug_report_platform" NOT NULL,
	"app_version" text,
	"device" text,
	"status" "bug_report_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_reports_status_created_at_index" ON "bug_reports" USING btree ("status","created_at");