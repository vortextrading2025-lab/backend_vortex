#!/usr/bin/env node

/**
 * Test Unit Name Generation
 */

const PlacementService = require('../../services/placementService');

console.log('🧪 Testing Unit Name Generation\n');

const testCases = [
  ['john@example.com', 101, 'john_101'],
  ['sarah.test@domain.com', 102, 'sarah.test_102'],
  ['user123@test.com', 2001, 'user123_2001'],
  ['test.user@example.co.uk', 3001, 'test.user_3001'],
  ['simple@email.com', 104, 'simple_104']
];

let passed = 0;
let failed = 0;

testCases.forEach(([email, num, expected]) => {
  const result = PlacementService.generateUnitName(email, num);
  const pass = result === expected;
  
  if (pass) {
    passed++;
    console.log(`✅ ${email}, ${num} → ${result}`);
  } else {
    failed++;
    console.log(`❌ ${email}, ${num} → ${result} (expected: ${expected})`);
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✨ All tests passed!');
  process.exit(0);
} else {
  console.log('💥 Some tests failed!');
  process.exit(1);
}

