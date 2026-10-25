/**
 * The built-in exercise library. Custom exercises live in the database with uuid ids; these use
 * stable slugs, so workouts can reference either.
 */

/** What a set records. Columns per kind come from TRACKING_FIELDS. */
export const EXERCISE_TRACKING = [
  "weight_reps",
  "reps",
  "duration",
  "distance_duration",
  "makes_attempts",
] as const;
export type ExerciseTracking = (typeof EXERCISE_TRACKING)[number];

export const TRACKING_LABELS: Record<ExerciseTracking, string> = {
  weight_reps: "Weight × reps",
  reps: "Reps (bodyweight)",
  duration: "Time",
  distance_duration: "Distance + time",
  makes_attempts: "Makes / attempts",
};

export type SetField = "weight" | "reps" | "duration" | "distance" | "attempts";

/** The columns a set shows, in order. `reps` doubles as makes for makes_attempts. */
export const TRACKING_FIELDS: Record<ExerciseTracking, SetField[]> = {
  weight_reps: ["weight", "reps"],
  reps: ["reps"],
  duration: ["duration"],
  distance_duration: ["distance", "duration"],
  makes_attempts: ["reps", "attempts"],
};

export const EXERCISE_CATEGORIES = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
  "full_body",
  "cardio",
  "sport",
  "mobility",
  "other",
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  legs: "Legs",
  core: "Core",
  full_body: "Full body",
  cardio: "Cardio",
  sport: "Sport & skill",
  mobility: "Mobility",
  other: "Other",
};

export interface CatalogExercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  tracking: ExerciseTracking;
}

const ex = (
  id: string,
  name: string,
  category: ExerciseCategory,
  tracking: ExerciseTracking = "weight_reps",
): CatalogExercise => ({ id, name, category, tracking });

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // Chest
  ex("bench-press-barbell", "Bench Press (Barbell)", "chest"),
  ex("bench-press-dumbbell", "Bench Press (Dumbbell)", "chest"),
  ex("incline-bench-press-barbell", "Incline Bench Press (Barbell)", "chest"),
  ex("incline-bench-press-dumbbell", "Incline Bench Press (Dumbbell)", "chest"),
  ex("chest-fly-dumbbell", "Chest Fly (Dumbbell)", "chest"),
  ex("cable-crossover", "Cable Crossover", "chest"),
  ex("chest-press-machine", "Chest Press (Machine)", "chest"),
  ex("push-up", "Push-up", "chest", "reps"),
  ex("dip", "Dip", "chest", "reps"),
  // Back
  ex("deadlift-barbell", "Deadlift (Barbell)", "back"),
  ex("bent-over-row-barbell", "Bent Over Row (Barbell)", "back"),
  ex("row-dumbbell", "Row (Dumbbell)", "back"),
  ex("seated-cable-row", "Seated Cable Row", "back"),
  ex("lat-pulldown", "Lat Pulldown (Cable)", "back"),
  ex("pull-up", "Pull-up", "back", "reps"),
  ex("chin-up", "Chin-up", "back", "reps"),
  ex("t-bar-row", "T-Bar Row", "back"),
  ex("back-extension", "Back Extension", "back", "reps"),
  // Shoulders
  ex("overhead-press-barbell", "Overhead Press (Barbell)", "shoulders"),
  ex("shoulder-press-dumbbell", "Shoulder Press (Dumbbell)", "shoulders"),
  ex("lateral-raise-dumbbell", "Lateral Raise (Dumbbell)", "shoulders"),
  ex("face-pull", "Face Pull (Cable)", "shoulders"),
  ex("rear-delt-fly", "Rear Delt Fly (Dumbbell)", "shoulders"),
  ex("shrug-dumbbell", "Shrug (Dumbbell)", "shoulders"),
  // Arms
  ex("bicep-curl-barbell", "Bicep Curl (Barbell)", "arms"),
  ex("bicep-curl-dumbbell", "Bicep Curl (Dumbbell)", "arms"),
  ex("hammer-curl", "Hammer Curl (Dumbbell)", "arms"),
  ex("triceps-pushdown", "Triceps Pushdown (Cable)", "arms"),
  ex("skullcrusher", "Skullcrusher (Barbell)", "arms"),
  ex("overhead-triceps-extension", "Overhead Triceps Extension", "arms"),
  // Legs
  ex("squat-barbell", "Squat (Barbell)", "legs"),
  ex("front-squat", "Front Squat (Barbell)", "legs"),
  ex("goblet-squat", "Goblet Squat", "legs"),
  ex("romanian-deadlift", "Romanian Deadlift (Barbell)", "legs"),
  ex("leg-press", "Leg Press", "legs"),
  ex("lunge-dumbbell", "Lunge (Dumbbell)", "legs"),
  ex("bulgarian-split-squat", "Bulgarian Split Squat", "legs"),
  ex("leg-extension", "Leg Extension (Machine)", "legs"),
  ex("leg-curl", "Leg Curl (Machine)", "legs"),
  ex("hip-thrust", "Hip Thrust (Barbell)", "legs"),
  ex("calf-raise", "Calf Raise", "legs"),
  ex("bodyweight-squat", "Bodyweight Squat", "legs", "reps"),
  // Core
  ex("plank", "Plank", "core", "duration"),
  ex("side-plank", "Side Plank", "core", "duration"),
  ex("crunch", "Crunch", "core", "reps"),
  ex("hanging-leg-raise", "Hanging Leg Raise", "core", "reps"),
  ex("ab-wheel", "Ab Wheel Rollout", "core", "reps"),
  ex("russian-twist", "Russian Twist", "core", "reps"),
  ex("cable-crunch", "Cable Crunch", "core"),
  // Full body
  ex("clean-and-jerk", "Clean and Jerk", "full_body"),
  ex("power-clean", "Power Clean", "full_body"),
  ex("snatch", "Snatch", "full_body"),
  ex("kettlebell-swing", "Kettlebell Swing", "full_body"),
  ex("thruster", "Thruster", "full_body"),
  ex("burpee", "Burpee", "full_body", "reps"),
  ex("farmers-carry", "Farmer's Carry", "full_body", "duration"),
  // Cardio
  ex("running", "Running", "cardio", "distance_duration"),
  ex("treadmill", "Treadmill", "cardio", "distance_duration"),
  ex("cycling", "Cycling", "cardio", "distance_duration"),
  ex("rowing-machine", "Rowing (Machine)", "cardio", "distance_duration"),
  ex("swimming", "Swimming", "cardio", "distance_duration"),
  ex("walking", "Walking", "cardio", "distance_duration"),
  ex("elliptical", "Elliptical", "cardio", "duration"),
  ex("stair-climber", "Stair Climber", "cardio", "duration"),
  ex("jump-rope", "Jump Rope", "cardio", "duration"),
  ex("sprints", "Sprints", "cardio", "distance_duration"),
  // Sport & skill
  ex("free-throws", "Free Throws", "sport", "makes_attempts"),
  ex("jump-shots", "Jump Shots", "sport", "makes_attempts"),
  ex("three-pointers", "Three-Pointers", "sport", "makes_attempts"),
  ex("penalty-kicks", "Penalty Kicks", "sport", "makes_attempts"),
  ex("serves", "Serves", "sport", "makes_attempts"),
  ex("putting", "Putting", "sport", "makes_attempts"),
  ex("ball-handling", "Ball Handling Drills", "sport", "duration"),
  ex("agility-ladder", "Agility Ladder", "sport", "duration"),
  ex("shuttle-run", "Shuttle Run", "sport", "duration"),
  ex("box-jump", "Box Jump", "sport", "reps"),
  ex("scrimmage", "Scrimmage / Game", "sport", "duration"),
  ex("practice", "Team Practice", "sport", "duration"),
  ex("shadowboxing", "Shadowboxing", "sport", "duration"),
  ex("heavy-bag", "Heavy Bag Rounds", "sport", "duration"),
  // Mobility
  ex("stretching", "Stretching", "mobility", "duration"),
  ex("yoga", "Yoga", "mobility", "duration"),
  ex("foam-rolling", "Foam Rolling", "mobility", "duration"),
];

export const CATALOG_BY_ID = new Map(EXERCISE_CATALOG.map((e) => [e.id, e]));
