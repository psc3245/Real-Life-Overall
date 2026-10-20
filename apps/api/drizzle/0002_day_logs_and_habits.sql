CREATE TYPE "public"."day_status" AS ENUM('open', 'submitted', 'recapped');--> statement-breakpoint
CREATE TYPE "public"."habit_type" AS ENUM('checkbox', 'checknote', 'counter', 'duration', 'slider', 'rating', 'shorttext', 'journal');--> statement-breakpoint
CREATE TABLE "day_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"journal" text DEFAULT '' NOT NULL,
	"status" "day_status" DEFAULT 'open' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"value_num" numeric(10, 2),
	"value_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_links" (
	"habit_id" uuid NOT NULL,
	"node_lineage_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "habit_type" NOT NULL,
	"config" jsonb NOT NULL,
	"days" smallint[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "day_logs" ADD CONSTRAINT "day_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_links" ADD CONSTRAINT "habit_links_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "day_logs_user_id_local_date_index" ON "day_logs" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_entries_habit_id_local_date_index" ON "habit_entries" USING btree ("habit_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_links_habit_id_node_lineage_id_index" ON "habit_links" USING btree ("habit_id","node_lineage_id");--> statement-breakpoint
CREATE INDEX "habits_user_id_index" ON "habits" USING btree ("user_id");