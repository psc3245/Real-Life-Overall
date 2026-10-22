CREATE TABLE "decay_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rating_events" ADD COLUMN "decay_run_id" uuid;--> statement-breakpoint
ALTER TABLE "decay_runs" ADD CONSTRAINT "decay_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decay_runs" ADD CONSTRAINT "decay_runs_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pauses" ADD CONSTRAINT "pauses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "decay_runs_one_active_per_day" ON "decay_runs" USING btree ("user_id","local_date") WHERE "decay_runs"."voided_at" is null;--> statement-breakpoint
CREATE INDEX "pauses_user_id_index" ON "pauses" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_decay_run_id_decay_runs_id_fk" FOREIGN KEY ("decay_run_id") REFERENCES "public"."decay_runs"("id") ON DELETE set null ON UPDATE no action;