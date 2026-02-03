const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get the test user
  const user = await prisma.user.findFirst({
    where: {
      email: { contains: 'test-416' }
    },
    include: {
      profiles: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (!user || !user.profiles[0]) {
    console.log('❌ No user or profile found');
    return;
  }

  const profile = user.profiles[0];

  console.log('✅ Found user:', user.email);
  console.log('\n=== MEAL STRUCTURE SETTINGS ===');
  console.log('mealsPerDay:', profile.mealsPerDay, '(expected: 4)');
  console.log('snacksPerDay:', profile.snacksPerDay, '(expected: 2)');
  console.log('cookingSkill:', profile.cookingSkill, '(expected: 6)');
  console.log('prepTimeMax:', profile.prepTimeMax, '(expected: 65)');
  console.log('macroStyle:', profile.macroStyle, '(expected: high_protein)');

  console.log('\n=== METABOLIC TARGETS (recalculated) ===');
  console.log('goalKcal:', profile.goalKcal);
  console.log('proteinTargetG:', profile.proteinTargetG);
  console.log('carbsTargetG:', profile.carbsTargetG);
  console.log('fatTargetG:', profile.fatTargetG);

  // Verify high_protein split (40P / 35C / 25F)
  const proteinPercent = Math.round((profile.proteinTargetG * 4) / profile.goalKcal * 100);
  const carbsPercent = Math.round((profile.carbsTargetG * 4) / profile.goalKcal * 100);
  const fatPercent = Math.round((profile.fatTargetG * 9) / profile.goalKcal * 100);

  console.log('\n=== MACRO SPLIT VERIFICATION ===');
  console.log('Protein:', proteinPercent + '% (expected ~40%)');
  console.log('Carbs:', carbsPercent + '% (expected ~35%)');
  console.log('Fat:', fatPercent + '% (expected ~25%)');

  console.log('\n=== VERIFICATION RESULTS ===');
  const checks = [
    { name: 'mealsPerDay = 4', pass: profile.mealsPerDay === 4 },
    { name: 'snacksPerDay = 2', pass: profile.snacksPerDay === 2 },
    { name: 'cookingSkill = 6', pass: profile.cookingSkill === 6 },
    { name: 'prepTimeMax = 65', pass: profile.prepTimeMax === 65 },
    { name: 'macroStyle = high_protein', pass: profile.macroStyle === 'high_protein' },
    { name: 'Protein ~40%', pass: proteinPercent >= 38 && proteinPercent <= 42 },
    { name: 'Carbs ~35%', pass: carbsPercent >= 33 && carbsPercent <= 37 },
    { name: 'Fat ~25%', pass: fatPercent >= 23 && fatPercent <= 27 },
  ];

  checks.forEach(check => {
    console.log(check.pass ? '✅' : '❌', check.name);
  });

  const allPass = checks.every(c => c.pass);
  console.log('\n' + (allPass ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
