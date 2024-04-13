if (process.env.HACK_HOUR_CHANNEL === undefined) {
  throw new Error('HACK_HOUR_CHANNEL is not defined');
}

if (process.env.HACK_HOUR_USERGROUP === undefined) {
  throw new Error('HACK_HOUR_USERGROUP is not defined');
}

// Constants
export const Constants = {
  MIN_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,

  //HACK_HOUR_CHANNEL: 'C06T6MQ1AMN', // PRIVATE
  //HACK_HOUR_CHANNEL: 'C06SBHMQU8G', // PROD
  HACK_HOUR_CHANNEL: process.env.HACK_HOUR_CHANNEL,

//HACK_HOUR_USERGROUP: 'S06RMCA6HBP', // PROD
  HACK_HOUR_USERGROUP: process.env.HACK_HOUR_USERGROUP,
};

// Commands
export const Commands = process.env.PROD === 'true' ? {
  HACK: '/hack',
  CANCEL: '/cancel',
  GOALS: '/goals',
  STATS: '/mystats',
  REMINDERS: '/reminders',
  EVENTS: '/picnics',
  INSTRUCTIONS: '/instructions'  
} : {
  HACK: '/ztesthack',
  CANCEL: '/testcancel',
  GOALS: '/testgoals',
  STATS: '/testmystats',
  REMINDERS: '/testreminders',
  EVENTS: '/testpicnics',
  INSTRUCTIONS: '/testinstructions'
};