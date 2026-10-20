export interface AttributeTemplate {
  key: string;
  name: string;
  description: string;
}

export interface CategoryTemplate {
  key: string;
  name: string;
  description: string;
  attributes: AttributeTemplate[];
}

/** Starter categories users can add and then edit freely (DESIGN.md §4.1). */
export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    key: "fitness",
    name: "Fitness",
    description: "Physical capability and conditioning",
    attributes: [
      { key: "fitness.cardio", name: "Cardio", description: "Endurance and aerobic capacity" },
      { key: "fitness.strength", name: "Strength", description: "Muscular strength and power" },
      { key: "fitness.mobility", name: "Mobility", description: "Flexibility and range of motion" },
      {
        key: "fitness.athleticism",
        name: "Athleticism",
        description: "Speed, agility, sport skill",
      },
    ],
  },
  {
    key: "health",
    name: "Health",
    description: "Habits that keep body and mind running well",
    attributes: [
      {
        key: "health.sleep",
        name: "Sleep",
        description: "Sleep quantity, quality and consistency",
      },
      { key: "health.nutrition", name: "Nutrition", description: "Diet quality and consistency" },
      {
        key: "health.recovery",
        name: "Recovery",
        description: "Rest, stress management, downtime",
      },
    ],
  },
  {
    key: "career",
    name: "Career",
    description: "Work, professional skills and trajectory",
    attributes: [
      { key: "career.skills", name: "Skills", description: "Depth of craft in your field" },
      { key: "career.output", name: "Output", description: "Productivity and shipped work" },
      {
        key: "career.leadership",
        name: "Leadership",
        description: "Influence, ownership, mentoring",
      },
      { key: "career.growth", name: "Growth", description: "Advancement and new opportunities" },
    ],
  },
  {
    key: "mind",
    name: "Mind",
    description: "Learning, focus and mental resilience",
    attributes: [
      { key: "mind.learning", name: "Learning", description: "Reading, courses, curiosity" },
      { key: "mind.focus", name: "Focus", description: "Deep work and attention control" },
      { key: "mind.discipline", name: "Discipline", description: "Doing what you said you would" },
      { key: "mind.composure", name: "Composure", description: "Emotional balance under pressure" },
    ],
  },
  {
    key: "social",
    name: "Social",
    description: "Relationships and community",
    attributes: [
      { key: "social.friendships", name: "Friendships", description: "Time and care for friends" },
      { key: "social.family", name: "Family", description: "Connection with family" },
      { key: "social.romance", name: "Romance", description: "Dating or partnership" },
      { key: "social.network", name: "Network", description: "Meeting people, community ties" },
    ],
  },
  {
    key: "finance",
    name: "Finance",
    description: "Money management and financial health",
    attributes: [
      { key: "finance.income", name: "Income", description: "Earning power" },
      { key: "finance.saving", name: "Saving", description: "Savings rate and emergency fund" },
      {
        key: "finance.budgeting",
        name: "Budgeting",
        description: "Tracking and controlling spend",
      },
      { key: "finance.investing", name: "Investing", description: "Long-term wealth building" },
    ],
  },
  {
    key: "creativity",
    name: "Creativity",
    description: "Making things and creative practice",
    attributes: [
      { key: "creativity.output", name: "Output", description: "How much you create" },
      { key: "creativity.craft", name: "Craft", description: "Technical skill in your medium" },
      {
        key: "creativity.exploration",
        name: "Exploration",
        description: "Trying new ideas and styles",
      },
    ],
  },
];
