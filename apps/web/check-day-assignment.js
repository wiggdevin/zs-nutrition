// Check day assignment for Feb 3, 2026
const start = new Date('2026-02-03');
start.setUTCHours(0, 0, 0, 0);

const jsDayToName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

console.log('Start date:', start.toDateString());
console.log('JS getDay():', start.getUTCDay(), '=', jsDayToName[start.getUTCDay()]);
console.log();

const trainingDaysSet = new Set(['monday', 'wednesday', 'friday']);

for (let d = 0; d < 7; d++) {
  const currentDate = new Date(start);
  currentDate.setUTCDate(start.getUTCDate() + d);

  const dayName = jsDayToName[currentDate.getUTCDay()];
  const isTrainingDay = trainingDaysSet.has(dayName);

  console.log(`Day ${d + 1}: ${currentDate.toDateString()} = ${dayName} [Training: ${isTrainingDay}]`);
}
