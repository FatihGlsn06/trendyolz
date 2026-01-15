/**
 * Tests for userProcessor
 *
 * These tests verify that both the original and refactored implementations
 * produce identical results, ensuring the refactoring maintained behavior.
 */

const { processUserData: processOriginal } = require('./userProcessor');
const {
  processUserData: processRefactored,
  validateEmail,
  validateName,
  validateAge,
  validatePhone,
  capitalizeName,
  determineAgeGroup,
  formatPhone,
  getMembershipDetails,
} = require('./userProcessor.refactored');

// ============================================================================
// Test Utilities
// ============================================================================

function assertResultsMatch(original, refactored, testName) {
  // Compare success status
  if (original.success !== refactored.success) {
    throw new Error(`${testName}: success mismatch - original: ${original.success}, refactored: ${refactored.success}`);
  }

  // Compare errors (sort for consistent comparison)
  const origErrors = [...original.errors].sort();
  const refErrors = [...refactored.errors].sort();
  if (JSON.stringify(origErrors) !== JSON.stringify(refErrors)) {
    throw new Error(`${testName}: errors mismatch\n  original: ${JSON.stringify(origErrors)}\n  refactored: ${JSON.stringify(refErrors)}`);
  }

  // Compare data (excluding timestamps which may differ by milliseconds)
  if (original.data && refactored.data) {
    const origData = { ...original.data };
    const refData = { ...refactored.data };
    delete origData.createdAt;
    delete origData.updatedAt;
    delete refData.createdAt;
    delete refData.updatedAt;

    if (JSON.stringify(origData) !== JSON.stringify(refData)) {
      throw new Error(`${testName}: data mismatch\n  original: ${JSON.stringify(origData)}\n  refactored: ${JSON.stringify(refData)}`);
    }
  }

  console.log(`✓ ${testName}`);
}

// ============================================================================
// Behavior Equivalence Tests
// ============================================================================

console.log('\n=== Behavior Equivalence Tests ===\n');

// Test 1: Valid complete user data
const validUser = {
  email: 'TEST@Example.com',
  name: 'john doe',
  age: 25,
  phone: '555-123-4567',
  address: {
    street: '123 Main St',
    city: 'New York',
    state: 'new york',
    zip: '10001',
  },
};

assertResultsMatch(
  processOriginal(validUser),
  processRefactored(validUser),
  'Valid complete user data'
);

// Test 2: Missing required fields
assertResultsMatch(
  processOriginal({}),
  processRefactored({}),
  'Missing required fields'
);

// Test 3: Invalid email formats
assertResultsMatch(
  processOriginal({ email: 'invalid' }),
  processRefactored({ email: 'invalid' }),
  'Invalid email (no @)'
);

assertResultsMatch(
  processOriginal({ email: 'test@test' }),
  processRefactored({ email: 'test@test' }),
  'Invalid email (no domain)'
);

// Test 4: Age edge cases
assertResultsMatch(
  processOriginal({ email: 'test@test.com', name: 'John', age: -1 }),
  processRefactored({ email: 'test@test.com', name: 'John', age: -1 }),
  'Negative age'
);

assertResultsMatch(
  processOriginal({ email: 'test@test.com', name: 'John', age: 151 }),
  processRefactored({ email: 'test@test.com', name: 'John', age: 151 }),
  'Age over limit'
);

assertResultsMatch(
  processOriginal({ email: 'test@test.com', name: 'John', age: 5.5 }),
  processRefactored({ email: 'test@test.com', name: 'John', age: 5.5 }),
  'Non-integer age'
);

// Test 5: Phone formatting options
assertResultsMatch(
  processOriginal({ email: 'test@test.com', name: 'John', phone: '5551234567' }, { phoneFormat: 'domestic' }),
  processRefactored({ email: 'test@test.com', name: 'John', phone: '5551234567' }, { phoneFormat: 'domestic' }),
  'Phone domestic format'
);

assertResultsMatch(
  processOriginal({ email: 'test@test.com', name: 'John', phone: '5551234567' }, { phoneFormat: 'international' }),
  processRefactored({ email: 'test@test.com', name: 'John', phone: '5551234567' }, { phoneFormat: 'international' }),
  'Phone international format'
);

// Test 6: Membership tiers
for (let tier = 1; tier <= 5; tier++) {
  assertResultsMatch(
    processOriginal({ email: 'test@test.com', name: 'John' }, { membershipTier: tier }),
    processRefactored({ email: 'test@test.com', name: 'John' }, { membershipTier: tier }),
    `Membership tier ${tier}`
  );
}

// Test 7: Age groups
const ageGroupTests = [
  { age: 5, expected: 'child' },
  { age: 15, expected: 'teenager' },
  { age: 25, expected: 'young_adult' },
  { age: 40, expected: 'adult' },
  { age: 55, expected: 'middle_aged' },
  { age: 70, expected: 'senior' },
];

ageGroupTests.forEach(({ age, expected }) => {
  const origResult = processOriginal({ email: 'test@test.com', name: 'John', age });
  const refResult = processRefactored({ email: 'test@test.com', name: 'John', age });
  assertResultsMatch(origResult, refResult, `Age group for age ${age}`);

  if (refResult.data.ageGroup !== expected) {
    throw new Error(`Age group mismatch for age ${age}: expected ${expected}, got ${refResult.data.ageGroup}`);
  }
});

// Test 8: Null/undefined input
assertResultsMatch(
  processOriginal(null),
  processRefactored(null),
  'Null input'
);

assertResultsMatch(
  processOriginal(undefined),
  processRefactored(undefined),
  'Undefined input'
);

// ============================================================================
// Unit Tests for Extracted Functions
// ============================================================================

console.log('\n=== Unit Tests for Extracted Functions ===\n');

// Test validateEmail
console.log('Testing validateEmail...');
console.assert(validateEmail('test@example.com').valid === true, 'Valid email should pass');
console.assert(validateEmail('').valid === false, 'Empty email should fail');
console.assert(validateEmail('nospace').valid === false, 'Email without @ should fail');
console.log('✓ validateEmail tests passed');

// Test validateName
console.log('Testing validateName...');
console.assert(validateName('John Doe').valid === true, 'Valid name should pass');
console.assert(validateName('A').valid === false, 'Single char name should fail');
console.assert(validateName(123).valid === false, 'Number name should fail');
console.log('✓ validateName tests passed');

// Test validateAge
console.log('Testing validateAge...');
console.assert(validateAge(25).valid === true, 'Valid age should pass');
console.assert(validateAge(-1).valid === false, 'Negative age should fail');
console.assert(validateAge(null).valid === true, 'Null age should pass (optional)');
console.log('✓ validateAge tests passed');

// Test capitalizeName
console.log('Testing capitalizeName...');
console.assert(capitalizeName('john doe') === 'John Doe', 'Should capitalize each word');
console.assert(capitalizeName('JANE DOE') === 'Jane Doe', 'Should handle all caps');
console.log('✓ capitalizeName tests passed');

// Test determineAgeGroup
console.log('Testing determineAgeGroup...');
console.assert(determineAgeGroup(5) === 'child', 'Age 5 should be child');
console.assert(determineAgeGroup(15) === 'teenager', 'Age 15 should be teenager');
console.assert(determineAgeGroup(70) === 'senior', 'Age 70 should be senior');
console.log('✓ determineAgeGroup tests passed');

// Test formatPhone
console.log('Testing formatPhone...');
console.assert(formatPhone('5551234567', 'domestic') === '(555) 123-4567', 'Domestic format');
console.assert(formatPhone('5551234567', 'international') === '+15551234567', 'International format');
console.log('✓ formatPhone tests passed');

// Test getMembershipDetails
console.log('Testing getMembershipDetails...');
console.assert(getMembershipDetails(1).name === 'basic', 'Tier 1 should be basic');
console.assert(getMembershipDetails(5).discount === 20, 'Tier 5 should have 20% discount');
console.assert(getMembershipDetails(99).name === 'basic', 'Unknown tier should default to basic');
console.log('✓ getMembershipDetails tests passed');

console.log('\n=== All Tests Passed! ===\n');
