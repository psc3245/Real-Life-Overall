ALTER TABLE "exercises" ALTER COLUMN "tracking" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "stats" text[];--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "sport" text;--> statement-breakpoint
UPDATE "exercises" SET
  "stats" = CASE "tracking"
    WHEN 'weight_reps' THEN ARRAY['weight', 'reps']
    WHEN 'reps' THEN ARRAY['reps']
    WHEN 'duration' THEN ARRAY['duration']
    WHEN 'distance_duration' THEN ARRAY['distance', 'duration']
    WHEN 'makes_attempts' THEN ARRAY['makes']
    WHEN 'weight_duration' THEN ARRAY['weight', 'duration']
    WHEN 'weight_distance' THEN ARRAY['weight', 'length']
    WHEN 'distance' THEN ARRAY['length']
  END,
  "headline" = CASE "tracking"
    WHEN 'weight_reps' THEN 'best1RmKg'
    WHEN 'reps' THEN 'mostReps'
    WHEN 'duration' THEN 'longestS'
    WHEN 'distance_duration' THEN 'longestM'
    WHEN 'makes_attempts' THEN 'bestPct'
    WHEN 'weight_duration' THEN 'heaviestKg'
    WHEN 'weight_distance' THEN 'heaviestKg'
    WHEN 'distance' THEN 'longestM'
  END;--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "stats" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "headline" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "box_score" jsonb;--> statement-breakpoint
UPDATE "workouts" SET "box_score" = "cardio" WHERE "cardio" IS NOT NULL;
