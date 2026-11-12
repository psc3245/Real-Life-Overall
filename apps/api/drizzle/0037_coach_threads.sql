CREATE TABLE "coach_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"focus_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_messages" ADD COLUMN "thread_id" uuid;--> statement-breakpoint
-- Each player's existing conversation becomes their first thread.
INSERT INTO "coach_threads" ("user_id", "title", "created_at", "updated_at")
SELECT "user_id", 'Earlier chat', min("created_at"), max("created_at") FROM "coach_messages" GROUP BY "user_id";--> statement-breakpoint
UPDATE "coach_messages" m SET "thread_id" = t."id" FROM "coach_threads" t WHERE t."user_id" = m."user_id";--> statement-breakpoint
ALTER TABLE "coach_messages" ALTER COLUMN "thread_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_threads" ADD CONSTRAINT "coach_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_threads_user_id_updated_at_index" ON "coach_threads" USING btree ("user_id","updated_at");--> statement-breakpoint
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_thread_id_coach_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."coach_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_messages_thread_id_created_at_index" ON "coach_messages" USING btree ("thread_id","created_at");