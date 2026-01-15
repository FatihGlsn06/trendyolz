/**
 * User data processor - Refactored version
 *
 * Key improvements:
 * 1. Extracted validation into separate, testable functions
 * 2. Eliminated deep nesting with early returns
 * 3. Replaced magic numbers with named constants
 * 4. Single responsibility for each function
 * 5. Extracted data transformations into pure functions
 * 6. Configuration-driven logic for membership tiers
 */

// ============================================================================
// Constants
// ============================================================================

const VALIDATION_LIMITS = {
  EMAIL_MIN_LENGTH: 5,
  EMAIL_MAX_LENGTH: 254,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  AGE_MIN: 0,
  AGE_MAX: 150,
  PHONE_MIN_DIGITS: 10,
  PHONE_MAX_DIGITS: 15,
  ZIP_SHORT_LENGTH: 5,
  ZIP_LONG_LENGTH: 9,
};

const AGE_GROUP_THRESHOLDS = [
  { max: 13, group: 'child' },
  { max: 20, group: 'teenager' },
  { max: 30, group: 'young_adult' },
  { max: 50, group: 'adult' },
  { max: 65, group: 'middle_aged' },
  { max: Infinity, group: 'senior' },
];

const MEMBERSHIP_TIERS = {
  1: { name: 'basic', discount: 0, freeShipping: false },
  2: { name: 'silver', discount: 5, freeShipping: false },
  3: { name: 'gold', discount: 10, freeShipping: true },
  4: { name: 'platinum', discount: 15, freeShipping: true },
  5: { name: 'diamond', discount: 20, freeShipping: true },
};

const DEFAULT_MEMBERSHIP = { name: 'basic', discount: 0, freeShipping: false };

const STATE_ABBREVIATIONS = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY',
};

// ============================================================================
// Validation Functions
// ============================================================================

function validateEmail(email) {
  if (!email) {
    return { valid: false, error: 'Email is required' };
  }

  if (!email.includes('@')) {
    return { valid: false, error: 'Email must contain @ symbol' };
  }

  if (!email.includes('.')) {
    return { valid: false, error: 'Email must contain a domain' };
  }

  const { EMAIL_MIN_LENGTH, EMAIL_MAX_LENGTH } = VALIDATION_LIMITS;
  if (email.length < EMAIL_MIN_LENGTH || email.length > EMAIL_MAX_LENGTH) {
    return { valid: false, error: `Email must be between ${EMAIL_MIN_LENGTH} and ${EMAIL_MAX_LENGTH} characters` };
  }

  return { valid: true, value: email.toLowerCase().trim() };
}

function validateName(name) {
  if (!name) {
    return { valid: false, error: 'Name is required' };
  }

  if (typeof name !== 'string') {
    return { valid: false, error: 'Name must be a string' };
  }

  const trimmedName = name.trim();
  const { NAME_MIN_LENGTH, NAME_MAX_LENGTH } = VALIDATION_LIMITS;

  if (trimmedName.length < NAME_MIN_LENGTH) {
    return { valid: false, error: `Name must be at least ${NAME_MIN_LENGTH} characters` };
  }

  if (trimmedName.length > NAME_MAX_LENGTH) {
    return { valid: false, error: `Name cannot exceed ${NAME_MAX_LENGTH} characters` };
  }

  return { valid: true, value: capitalizeName(trimmedName) };
}

function validateAge(age) {
  if (age === undefined || age === null) {
    return { valid: true, value: null }; // Age is optional
  }

  if (typeof age !== 'number' || isNaN(age)) {
    return { valid: false, error: 'Age must be a valid number' };
  }

  if (!Number.isInteger(age)) {
    return { valid: false, error: 'Age must be a whole number' };
  }

  const { AGE_MIN, AGE_MAX } = VALIDATION_LIMITS;

  if (age < AGE_MIN) {
    return { valid: false, error: 'Age cannot be negative' };
  }

  if (age > AGE_MAX) {
    return { valid: false, error: `Age cannot exceed ${AGE_MAX}` };
  }

  return { valid: true, value: age, ageGroup: determineAgeGroup(age) };
}

function validatePhone(phone) {
  if (!phone) {
    return { valid: true, value: null }; // Phone is optional
  }

  const digitsOnly = phone.toString().replace(/[^0-9]/g, '');
  const { PHONE_MIN_DIGITS, PHONE_MAX_DIGITS } = VALIDATION_LIMITS;

  if (digitsOnly.length < PHONE_MIN_DIGITS || digitsOnly.length > PHONE_MAX_DIGITS) {
    return { valid: false, error: `Phone number must be between ${PHONE_MIN_DIGITS} and ${PHONE_MAX_DIGITS} digits` };
  }

  return { valid: true, value: digitsOnly };
}

function validateAddress(address) {
  if (!address) {
    return { valid: true, value: null }; // Address is optional
  }

  if (typeof address !== 'object') {
    return { valid: false, error: 'Address must be an object' };
  }

  const errors = [];
  const processedAddress = {};

  // Validate street
  if (address.street) {
    if (typeof address.street !== 'string' || !address.street.trim()) {
      errors.push('Street must be a non-empty string');
    } else {
      processedAddress.street = address.street.trim();
    }
  }

  // Validate city
  if (address.city) {
    if (typeof address.city !== 'string' || !address.city.trim()) {
      errors.push('City must be a non-empty string');
    } else {
      processedAddress.city = address.city.trim();
    }
  }

  // Validate state
  if (address.state) {
    const stateResult = normalizeState(address.state);
    if (stateResult.error) {
      errors.push(stateResult.error);
    } else {
      processedAddress.state = stateResult.value;
    }
  }

  // Validate ZIP
  if (address.zip) {
    const zipResult = normalizeZip(address.zip);
    if (zipResult.error) {
      errors.push(zipResult.error);
    } else {
      processedAddress.zip = zipResult.value;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, value: processedAddress };
}

// ============================================================================
// Transformation Functions
// ============================================================================

function capitalizeName(name) {
  return name
    .split(' ')
    .map(word => word.length > 0
      ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      : word
    )
    .join(' ');
}

function determineAgeGroup(age) {
  const threshold = AGE_GROUP_THRESHOLDS.find(t => age < t.max);
  return threshold ? threshold.group : 'senior';
}

function normalizeState(state) {
  if (typeof state !== 'string') {
    return { error: 'State must be a string' };
  }

  const trimmed = state.trim();

  if (trimmed.length === 2) {
    return { value: trimmed.toUpperCase() };
  }

  if (trimmed.length < 2) {
    return { error: 'State must be at least 2 characters' };
  }

  const abbreviation = STATE_ABBREVIATIONS[trimmed.toLowerCase()];
  if (abbreviation) {
    return { value: abbreviation };
  }

  return { error: 'Invalid state name' };
}

function normalizeZip(zip) {
  const digitsOnly = zip.toString().replace(/[^0-9]/g, '');
  const { ZIP_SHORT_LENGTH, ZIP_LONG_LENGTH } = VALIDATION_LIMITS;

  if (digitsOnly.length !== ZIP_SHORT_LENGTH && digitsOnly.length !== ZIP_LONG_LENGTH) {
    return { error: `ZIP code must be ${ZIP_SHORT_LENGTH} or ${ZIP_LONG_LENGTH} digits` };
  }

  const formattedZip = digitsOnly.length === ZIP_LONG_LENGTH
    ? `${digitsOnly.substring(0, 5)}-${digitsOnly.substring(5)}`
    : digitsOnly;

  return { value: formattedZip };
}

function formatPhone(phone, format) {
  if (!phone || !format) {
    return phone;
  }

  const normalizedPhone = phone.startsWith('1') && phone.length === 11
    ? phone.substring(1)
    : phone;

  if (format === 'international') {
    return phone.length === 10 ? `+1${phone}` : `+${phone}`;
  }

  if (format === 'domestic' && normalizedPhone.length === 10) {
    return `(${normalizedPhone.substring(0, 3)}) ${normalizedPhone.substring(3, 6)}-${normalizedPhone.substring(6)}`;
  }

  return phone;
}

function getMembershipDetails(tier) {
  return MEMBERSHIP_TIERS[tier] || DEFAULT_MEMBERSHIP;
}

// ============================================================================
// Main Processing Function
// ============================================================================

function processUserData(userData, options = {}) {
  const errors = [];
  const data = {};

  if (!userData) {
    return { success: false, data: null, errors: ['User data is required'] };
  }

  // Validate and process email (required)
  const emailResult = validateEmail(userData.email);
  if (!emailResult.valid) {
    errors.push(emailResult.error);
  } else {
    data.email = emailResult.value;
  }

  // Validate and process name (required)
  const nameResult = validateName(userData.name);
  if (!nameResult.valid) {
    errors.push(nameResult.error);
  } else {
    data.name = nameResult.value;
  }

  // Validate and process age (optional)
  const ageResult = validateAge(userData.age);
  if (!ageResult.valid) {
    errors.push(ageResult.error);
  } else if (ageResult.value !== null) {
    data.age = ageResult.value;
    data.ageGroup = ageResult.ageGroup;
  }

  // Validate and process phone (optional)
  const phoneResult = validatePhone(userData.phone);
  if (!phoneResult.valid) {
    errors.push(phoneResult.error);
  } else if (phoneResult.value) {
    data.phone = phoneResult.value;
    data.formattedPhone = formatPhone(phoneResult.value, options.phoneFormat);
  }

  // Validate and process address (optional)
  const addressResult = validateAddress(userData.address);
  if (!addressResult.valid) {
    errors.push(...(addressResult.errors || [addressResult.error]));
  } else if (addressResult.value) {
    data.address = addressResult.value;
  }

  // Apply membership tier
  if (options.membershipTier) {
    const membership = getMembershipDetails(options.membershipTier);
    data.membership = membership.name;
    data.discount = membership.discount;
    data.freeShipping = membership.freeShipping;
  }

  // Add timestamps
  const now = new Date().toISOString();
  data.createdAt = now;
  data.updatedAt = now;

  return {
    success: errors.length === 0,
    data: Object.keys(data).length > 0 ? data : null,
    errors,
  };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  processUserData,
  // Export individual validators for unit testing
  validateEmail,
  validateName,
  validateAge,
  validatePhone,
  validateAddress,
  // Export transformers for unit testing
  capitalizeName,
  determineAgeGroup,
  normalizeState,
  normalizeZip,
  formatPhone,
  getMembershipDetails,
  // Export constants for testing
  VALIDATION_LIMITS,
  AGE_GROUP_THRESHOLDS,
  MEMBERSHIP_TIERS,
  STATE_ABBREVIATIONS,
};
