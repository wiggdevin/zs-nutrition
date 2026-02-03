// Onboarding data types matching the app spec's RawIntakeForm schema

export type Sex = 'male' | 'female';
export type GoalType = 'cut' | 'maintain' | 'bulk';
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
export type DietaryStyle = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo';
export type MacroStyle = 'balanced' | 'high_protein' | 'low_carb' | 'keto';
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type UnitSystem = 'imperial' | 'metric';

export interface OnboardingData {
  // Step 1: Demographics
  name: string;
  sex: Sex | '';
  age: number | null;

  // Step 2: Body Metrics
  unitSystem: UnitSystem;
  heightFeet: number | null;
  heightInches: number | null;
  heightCm: number | null;
  weightLbs: number | null;
  weightKg: number | null;
  bodyFatPercent: number | null;

  // Step 3: Goals
  goalType: GoalType | '';
  goalRate: number;

  // Step 4: Dietary
  dietaryStyle: DietaryStyle | '';
  allergies: string[];
  exclusions: string[];

  // Step 5: Lifestyle
  activityLevel: ActivityLevel | '';
  trainingDays: Weekday[];
  cookingSkill: number;
  prepTimeMax: number;

  // Step 6: Preferences
  macroStyle: MacroStyle | '';
  cuisinePreferences: string[];
  mealsPerDay: number;
  snacksPerDay: number;
}

export const defaultOnboardingData: OnboardingData = {
  name: '',
  sex: '',
  age: null,
  unitSystem: 'imperial',
  heightFeet: null,
  heightInches: null,
  heightCm: null,
  weightLbs: null,
  weightKg: null,
  bodyFatPercent: null,
  goalType: '',
  goalRate: 1,
  dietaryStyle: '',
  allergies: [],
  exclusions: [],
  activityLevel: '',
  trainingDays: [],
  cookingSkill: 5,
  prepTimeMax: 30,
  macroStyle: '',
  cuisinePreferences: [],
  mealsPerDay: 3,
  snacksPerDay: 1,
};

export const TOTAL_STEPS = 6;
