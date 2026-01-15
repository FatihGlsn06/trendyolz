/**
 * User data processor - processes user registration data and returns formatted result
 *
 * NOTE: This file demonstrates an overly complex function that needs refactoring.
 * See userProcessor.refactored.js for the improved version.
 */

function processUserData(userData, options) {
  let result = { success: false, data: null, errors: [] };

  // Validate and process user data
  if (userData) {
    if (userData.email) {
      if (userData.email.indexOf('@') !== -1) {
        if (userData.email.indexOf('.') !== -1) {
          if (userData.email.length >= 5 && userData.email.length <= 254) {
            result.data = result.data || {};
            result.data.email = userData.email.toLowerCase().trim();
          } else {
            result.errors.push('Email must be between 5 and 254 characters');
          }
        } else {
          result.errors.push('Email must contain a domain');
        }
      } else {
        result.errors.push('Email must contain @ symbol');
      }
    } else {
      result.errors.push('Email is required');
    }

    // Process name
    if (userData.name) {
      if (typeof userData.name === 'string') {
        if (userData.name.trim().length >= 2) {
          if (userData.name.trim().length <= 100) {
            result.data = result.data || {};
            let processedName = userData.name.trim();
            // Capitalize first letter of each word
            processedName = processedName.split(' ').map(function(word) {
              if (word.length > 0) {
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
              }
              return word;
            }).join(' ');
            result.data.name = processedName;
          } else {
            result.errors.push('Name cannot exceed 100 characters');
          }
        } else {
          result.errors.push('Name must be at least 2 characters');
        }
      } else {
        result.errors.push('Name must be a string');
      }
    } else {
      result.errors.push('Name is required');
    }

    // Process age
    if (userData.age !== undefined && userData.age !== null) {
      if (typeof userData.age === 'number') {
        if (!isNaN(userData.age)) {
          if (userData.age >= 0) {
            if (userData.age <= 150) {
              if (Number.isInteger(userData.age)) {
                result.data = result.data || {};
                result.data.age = userData.age;
                // Set age group
                if (userData.age < 13) {
                  result.data.ageGroup = 'child';
                } else if (userData.age >= 13 && userData.age < 20) {
                  result.data.ageGroup = 'teenager';
                } else if (userData.age >= 20 && userData.age < 30) {
                  result.data.ageGroup = 'young_adult';
                } else if (userData.age >= 30 && userData.age < 50) {
                  result.data.ageGroup = 'adult';
                } else if (userData.age >= 50 && userData.age < 65) {
                  result.data.ageGroup = 'middle_aged';
                } else {
                  result.data.ageGroup = 'senior';
                }
              } else {
                result.errors.push('Age must be a whole number');
              }
            } else {
              result.errors.push('Age cannot exceed 150');
            }
          } else {
            result.errors.push('Age cannot be negative');
          }
        } else {
          result.errors.push('Age must be a valid number');
        }
      } else {
        result.errors.push('Age must be a number');
      }
    }

    // Process phone
    if (userData.phone) {
      let phone = userData.phone.toString().replace(/[^0-9]/g, '');
      if (phone.length >= 10 && phone.length <= 15) {
        result.data = result.data || {};
        result.data.phone = phone;
        // Determine phone type based on options
        if (options && options.phoneFormat) {
          if (options.phoneFormat === 'international') {
            if (phone.length === 10) {
              result.data.formattedPhone = '+1' + phone;
            } else if (phone.length === 11 && phone.charAt(0) === '1') {
              result.data.formattedPhone = '+' + phone;
            } else {
              result.data.formattedPhone = '+' + phone;
            }
          } else if (options.phoneFormat === 'domestic') {
            if (phone.length === 10) {
              result.data.formattedPhone = '(' + phone.substring(0, 3) + ') ' + phone.substring(3, 6) + '-' + phone.substring(6);
            } else if (phone.length === 11 && phone.charAt(0) === '1') {
              phone = phone.substring(1);
              result.data.formattedPhone = '(' + phone.substring(0, 3) + ') ' + phone.substring(3, 6) + '-' + phone.substring(6);
            } else {
              result.data.formattedPhone = phone;
            }
          } else {
            result.data.formattedPhone = phone;
          }
        } else {
          result.data.formattedPhone = phone;
        }
      } else {
        result.errors.push('Phone number must be between 10 and 15 digits');
      }
    }

    // Process address
    if (userData.address) {
      if (typeof userData.address === 'object') {
        result.data = result.data || {};
        result.data.address = {};

        if (userData.address.street) {
          if (typeof userData.address.street === 'string' && userData.address.street.trim().length > 0) {
            result.data.address.street = userData.address.street.trim();
          } else {
            result.errors.push('Street must be a non-empty string');
          }
        }

        if (userData.address.city) {
          if (typeof userData.address.city === 'string' && userData.address.city.trim().length > 0) {
            result.data.address.city = userData.address.city.trim();
          } else {
            result.errors.push('City must be a non-empty string');
          }
        }

        if (userData.address.state) {
          if (typeof userData.address.state === 'string') {
            if (userData.address.state.trim().length === 2) {
              result.data.address.state = userData.address.state.trim().toUpperCase();
            } else if (userData.address.state.trim().length > 2) {
              // Try to convert full state name to abbreviation
              const stateMap = {
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
                'wisconsin': 'WI', 'wyoming': 'WY'
              };
              const stateLower = userData.address.state.trim().toLowerCase();
              if (stateMap[stateLower]) {
                result.data.address.state = stateMap[stateLower];
              } else {
                result.errors.push('Invalid state name');
              }
            } else {
              result.errors.push('State must be at least 2 characters');
            }
          } else {
            result.errors.push('State must be a string');
          }
        }

        if (userData.address.zip) {
          let zip = userData.address.zip.toString().replace(/[^0-9]/g, '');
          if (zip.length === 5 || zip.length === 9) {
            result.data.address.zip = zip.length === 9 ? zip.substring(0, 5) + '-' + zip.substring(5) : zip;
          } else {
            result.errors.push('ZIP code must be 5 or 9 digits');
          }
        }
      } else {
        result.errors.push('Address must be an object');
      }
    }

    // Set membership level based on options
    if (options && options.membershipTier) {
      result.data = result.data || {};
      if (options.membershipTier === 1) {
        result.data.membership = 'basic';
        result.data.discount = 0;
        result.data.freeShipping = false;
      } else if (options.membershipTier === 2) {
        result.data.membership = 'silver';
        result.data.discount = 5;
        result.data.freeShipping = false;
      } else if (options.membershipTier === 3) {
        result.data.membership = 'gold';
        result.data.discount = 10;
        result.data.freeShipping = true;
      } else if (options.membershipTier === 4) {
        result.data.membership = 'platinum';
        result.data.discount = 15;
        result.data.freeShipping = true;
      } else if (options.membershipTier === 5) {
        result.data.membership = 'diamond';
        result.data.discount = 20;
        result.data.freeShipping = true;
      } else {
        result.data.membership = 'basic';
        result.data.discount = 0;
        result.data.freeShipping = false;
      }
    }

    // Set timestamps
    result.data = result.data || {};
    result.data.createdAt = new Date().toISOString();
    result.data.updatedAt = new Date().toISOString();

    // Set success status
    if (result.errors.length === 0) {
      result.success = true;
    }
  } else {
    result.errors.push('User data is required');
  }

  return result;
}

module.exports = { processUserData };
