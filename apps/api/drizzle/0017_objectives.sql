CREATE TYPE "public"."objective_source" AS ENUM('manual', 'habit');--> statement-breakpoint
CREATE TABLE "objective_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"objective_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objective_links" (
	"objective_id" uuid NOT NULL,
	"node_lineage_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"target" numeric(12, 2) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"source" "objective_source" DEFAULT 'manual' NOT NULL,
	"habit_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "objectives_window" CHECK ("objectives"."ends_on" >= "objectives"."starts_on"),
	CONSTRAINT "objectives_target_positive" CHECK ("objectives"."target" > 0)
);
--> statement-breakpoint
ALTER TABLE "objective_entries" ADD CONSTRAINT "objective_entries_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_links" ADD CONSTRAINT "objective_links_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "objective_entries_objective_id_local_date_index" ON "objective_entries" USING btree ("objective_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "objective_links_objective_id_node_lineage_id_index" ON "objective_links" USING btree ("objective_id","node_lineage_id");--> statement-breakpoint
CREATE INDEX "objectives_user_id_index" ON "objectives" USING btree ("user_id");