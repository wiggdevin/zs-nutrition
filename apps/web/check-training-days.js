const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'zero-sum-nutrition/apps/web/prisma/dev.db');
const db = new Database(dbPath, { readonly: true });

console.log('=== Checking Training Days Configuration ===\n');

// Get users
const users = db.prepare('SELECT id, clerkUserId, email FROM User LIMIT 5').all();
console.log('Users:', users);

if (users.length > 0) {
  const user = users[0];
  console.log('\n=== Primary User ===');
  console.log('ID:', user.id);
  console.log('Email:', user.email);

  // Get user profile
  const profile = db.prepare('SELECT * FROM UserProfile WHERE userId = ?').get(user.id);
  if (profile) {
    console.log('\n=== Profile ===');
    console.log('Name:', profile.name);
    console.log('Training Days (raw):', profile.trainingDays);

    let trainingDays = [];
    try {
      trainingDays = JSON.parse(profile.trainingDays);
      console.log('Training Days (parsed):', trainingDays);
    } catch (e) {
      console.log('Failed to parse training days');
    }

    console.log('Goal Kcal:', profile.goalKcal);
    console.log('Protein Target:', profile.proteinTargetG);
  } else {
    console.log('\nNo profile found');
  }

  // Get meal plan
  const plan = db.prepare('SELECT * FROM MealPlan WHERE userId = ? AND isActive = 1 LIMIT 1').get(user.id);
  if (plan) {
    console.log('\n=== Active Meal Plan ===');
    console.log('Plan ID:', plan.id);
    console.log('Daily Kcal Target:', plan.dailyKcalTarget);
    console.log('Training Bonus Kcal:', plan.trainingBonusKcal);
  } else {
    console.log('\nNo active meal plan');
  }
}

// Check current day
const now = new Date();
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
console.log('\n=== Current Day Detection ===');
console.log('Current UTC:', now.toISOString());
console.log('getDay():', now.getDay());
console.log('Day name:', days[now.getDay()]);
console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

db.close();
