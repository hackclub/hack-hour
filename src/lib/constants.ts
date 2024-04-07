// Constants
const PROD = false; // Production Mode
const IN_DEV = true; // Currently Developing It

// Prod Constants
/*
export const Constants = {
  HACK_HOUR_CHANNEL: 'C06SBHMQU8G', // PROD
  MIN_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,

  FILE_PATH: './data/db.json',

  HACK_HOUR_USERGROUP: 'S06RMCA6HBP',
};
*/

// Dev Constants
export const Constants = {
//HACK_HOUR_CHANNEL: 'C06T6MQ1AMN', // PRIVATE
  HACK_HOUR_CHANNEL: 'C06S6E7CXK7', // DEV
  MIN_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,

  FILE_PATH: './data/db.json',

  HACK_HOUR_USERGROUP: 'S06T62H1602',
};

if (PROD) {
  console.log("In Production.");
} else {
  console.log("In Development.");
}

if (IN_DEV && PROD) {
  // This should never happen
  throw new Error("Conflict: Currently in production while developing. Something's wrong.");
}
