CREATE TABLE "habit_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "bucket_id" uuid;--> statement-breakpoint
ALTER TABLE "habit_buckets" ADD CONSTRAINT "habit_buckets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "habit_buckets_user_id_index" ON "habit_buckets" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_bucket_id_habit_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."habit_buckets"("id") ON DELETE set null ON UPDATE no action;