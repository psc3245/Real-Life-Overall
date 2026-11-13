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
  "weight_duration",
  "weight_distance",
  "distance",
] as const;
export type ExerciseTracking = (typeof EXERCISE_TRACKING)[number];

export const TRACKING_LABELS: Record<ExerciseTracking, string> = {
  weight_reps: "Weight × reps",
  reps: "Reps (bodyweight)",
  duration: "Time",
  distance_duration: "Distance + time",
  makes_attempts: "Makes / attempts",
  weight_duration: "Weight + time",
  weight_distance: "Weight + distance",
  distance: "Distance",
};

export type SetField = "weight" | "reps" | "duration" | "distance" | "length" | "attempts";

/**
 * The columns a set shows, in order. `reps` doubles as makes for makes_attempts; `distance` (mi
 * or km) and `length` (ft or m, for short distances) are both stored as `distanceM`.
 */
export const TRACKING_FIELDS: Record<ExerciseTracking, SetField[]> = {
  weight_reps: ["weight", "reps"],
  reps: ["reps"],
  duration: ["duration"],
  distance_duration: ["distance", "duration"],
  makes_attempts: ["reps", "attempts"],
  weight_duration: ["weight", "duration"],
  weight_distance: ["weight", "length"],
  distance: ["length"],
};

/** Whether a tracking kind's sets record `distanceM` (as a distance or a length). */
export const recordsDistance = (tracking: ExerciseTracking) =>
  TRACKING_FIELDS[tracking].some((f) => f === "distance" || f === "length");

/** Whether a tracking kind shows its distance as a length (ft or m). */
export const usesLength = (tracking: ExerciseTracking) =>
  TRACKING_FIELDS[tracking].includes("length");

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

/** Sports that sport & skill drills belong to; "athletic" is speed, agility and power for any. */
export const SPORTS = [
  "athletic",
  "basketball",
  "soccer",
  "football",
  "baseball",
  "tennis",
  "golf",
  "volleyball",
  "hockey",
  "boxing",
  "track",
] as const;
export type Sport = (typeof SPORTS)[number];

export const SPORT_LABELS: Record<Sport, string> = {
  athletic: "Athleticism",
  basketball: "Basketball",
  soccer: "Soccer",
  football: "Football",
  baseball: "Baseball & softball",
  tennis: "Tennis",
  golf: "Golf",
  volleyball: "Volleyball",
  hockey: "Hockey",
  boxing: "Boxing & combat",
  track: "Track & field",
};

export interface CatalogExercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  tracking: ExerciseTracking;
  /** Sport & skill drills only; null for drills that fit any sport. */
  sport: Sport | null;
}

const ex = (
  id: string,
  name: string,
  category: ExerciseCategory,
  tracking: ExerciseTracking = "weight_reps",
  sport: Sport | null = null,
): CatalogExercise => ({ id, name, category, tracking, sport });

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
  ex("weighted-plank", "Weighted Plank", "core", "weight_duration"),
  // Full body
  ex("clean-and-jerk", "Clean and Jerk", "full_body"),
  ex("power-clean", "Power Clean", "full_body"),
  ex("snatch", "Snatch", "full_body"),
  ex("kettlebell-swing", "Kettlebell Swing", "full_body"),
  ex("thruster", "Thruster", "full_body"),
  ex("burpee", "Burpee", "full_body", "reps"),
  ex("farmers-carry", "Farmer's Carry", "full_body", "weight_duration"),
  ex("farmers-walk-distance", "Farmer's Walk (Distance)", "full_body", "weight_distance"),
  ex("sled-push", "Sled Push", "full_body", "weight_distance"),
  ex("sled-pull", "Sled Pull", "full_body", "weight_distance"),
  ex("dead-hang", "Dead Hang", "back", "duration"),
  ex("weighted-dead-hang", "Weighted Dead Hang", "back", "weight_duration"),
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
  ex("hiking", "Hiking", "cardio", "distance_duration"),
  ex("indoor-cycling", "Indoor Cycling", "cardio", "distance_duration"),
  // Sport & skill: athleticism (speed, agility, power)
  ex("agility-ladder", "Agility Ladder", "sport", "duration", "athletic"),
  ex("cone-drills", "Cone Drills", "sport", "duration", "athletic"),
  ex("shuttle-run", "Shuttle Run", "sport", "duration", "athletic"),
  ex("forty-yard-dash", "40-Yard Dash", "sport", "duration", "athletic"),
  ex("reaction-drills", "Reaction Drills", "sport", "duration", "athletic"),
  ex("box-jump", "Box Jump", "sport", "reps", "athletic"),
  ex("depth-jump", "Depth Jump", "sport", "reps", "athletic"),
  ex("lateral-bounds", "Lateral Bounds", "sport", "reps", "athletic"),
  ex("skater-jumps", "Skater Jumps", "sport", "reps", "athletic"),
  ex("vertical-jump", "Vertical Jump", "sport", "distance", "athletic"),
  ex("broad-jump", "Broad Jump", "sport", "distance", "athletic"),
  ex("med-ball-slam", "Medicine Ball Slam", "sport", "weight_reps", "athletic"),
  ex("med-ball-throw", "Medicine Ball Rotational Throw", "sport", "weight_reps", "athletic"),
  ex("resisted-sprint", "Resisted Sprint (Sled)", "sport", "weight_distance", "athletic"),
  // Basketball
  ex("free-throws", "Free Throws", "sport", "makes_attempts", "basketball"),
  ex("jump-shots", "Jump Shots", "sport", "makes_attempts", "basketball"),
  ex("three-pointers", "Three-Pointers", "sport", "makes_attempts", "basketball"),
  ex("mid-range-shots", "Mid-Range Shots", "sport", "makes_attempts", "basketball"),
  ex("layups", "Layups", "sport", "makes_attempts", "basketball"),
  ex("mikan-drill", "Mikan Drill", "sport", "reps", "basketball"),
  ex("ball-handling", "Ball Handling Drills", "sport", "duration", "basketball"),
  ex("defensive-slides", "Defensive Slides", "sport", "duration", "basketball"),
  // Soccer
  ex("penalty-kicks", "Penalty Kicks", "sport", "makes_attempts", "soccer"),
  ex("shots-on-target", "Shots on Target", "sport", "makes_attempts", "soccer"),
  ex("crossing", "Crossing", "sport", "makes_attempts", "soccer"),
  ex("juggling", "Juggling", "sport", "reps", "soccer"),
  ex("soccer-dribbling", "Dribbling Drills (Soccer)", "sport", "duration", "soccer"),
  ex("passing-drills", "Passing Drills (Soccer)", "sport", "duration", "soccer"),
  // Football
  ex("passing-accuracy", "Passing Accuracy", "sport", "makes_attempts", "football"),
  ex("catching-drills", "Catching Drills", "sport", "makes_attempts", "football"),
  ex("field-goals", "Field Goals", "sport", "makes_attempts", "football"),
  ex("route-running", "Route Running", "sport", "duration", "football"),
  // Baseball & softball
  ex("batting-practice", "Batting Practice (Solid Contact)", "sport", "makes_attempts", "baseball"),
  ex("pitching-strikes", "Pitching (Strikes)", "sport", "makes_attempts", "baseball"),
  ex("tee-work", "Tee Work", "sport", "reps", "baseball"),
  ex("fielding-drills", "Fielding Drills", "sport", "duration", "baseball"),
  // Tennis
  ex("serves", "Serves", "sport", "makes_attempts", "tennis"),
  ex("groundstrokes", "Groundstroke Rally", "sport", "duration", "tennis"),
  ex("volleys", "Volley Drills", "sport", "duration", "tennis"),
  // Golf
  ex("putting", "Putting", "sport", "makes_attempts", "golf"),
  ex("chipping", "Chipping (Inside 6 ft)", "sport", "makes_attempts", "golf"),
  ex("driving-range", "Driving Range (Balls)", "sport", "reps", "golf"),
  ex("golf-drive", "Golf Drive", "sport", "distance", "golf"),
  // Volleyball
  ex("volleyball-serves", "Serves (Volleyball)", "sport", "makes_attempts", "volleyball"),
  ex("volleyball-passing", "Passing (Volleyball)", "sport", "makes_attempts", "volleyball"),
  ex("approach-jumps", "Approach Jumps", "sport", "reps", "volleyball"),
  // Hockey
  ex("hockey-shots", "Shots on Net (Hockey)", "sport", "makes_attempts", "hockey"),
  ex("stickhandling", "Stickhandling", "sport", "duration", "hockey"),
  ex("skating-drills", "Skating Drills", "sport", "duration", "hockey"),
  // Boxing & combat
  ex("shadowboxing", "Shadowboxing", "sport", "duration", "boxing"),
  ex("heavy-bag", "Heavy Bag Rounds", "sport", "duration", "boxing"),
  ex("mitt-work", "Mitt Work", "sport", "duration", "boxing"),
  ex("speed-bag", "Speed Bag", "sport", "duration", "boxing"),
  ex("sparring", "Sparring Rounds", "sport", "duration", "boxing"),
  // Track & field
  ex("long-jump", "Long Jump", "sport", "distance", "track"),
  ex("triple-jump", "Triple Jump", "sport", "distance", "track"),
  ex("high-jump", "High Jump", "sport", "distance", "track"),
  ex("shot-put", "Shot Put", "sport", "distance", "track"),
  ex("discus", "Discus", "sport", "distance", "track"),
  // Any sport
  ex("scrimmage", "Scrimmage / Game", "sport", "duration"),
  ex("practice", "Team Practice", "sport", "duration"),
  // Mobility
  ex("stretching", "Stretching", "mobility", "duration"),
  ex("yoga", "Yoga", "mobility", "duration"),
  ex("foam-rolling", "Foam Rolling", "mobility", "duration"),
];

export const CATALOG_BY_ID = new Map(EXERCISE_CATALOG.map((e) => [e.id, e]));
