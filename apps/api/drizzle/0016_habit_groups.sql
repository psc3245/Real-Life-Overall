ALTER TYPE "public"."habit_type" ADD VALUE 'group';--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_parent_id_habits_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "habits_parent_id_index" ON "habits" USING btree ("parent_id");