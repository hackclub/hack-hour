// Environment Variables - typescript doesn't typecheck process.env
// Throw if not defined
function assertEnv(envVar: string): string { 
  if (!process.env[envVar]) { 
    throw new Error(`Environment variable ${envVar} is not defined.`); 
  } else {
    return process.env[envVar] as string;
  }
}

export const Environment = {
  // Server
  SLACK_APP_TOKEN: assertEnv('SLACK_APP_TOKEN'),
  SLACK_BOT_TOKEN: assertEnv('SLACK_BOT_TOKEN'),
  SLACK_SIGNING_SECRET: assertEnv('SLACK_SIGNING_SECRET'),

  PORT: assertEnv('PORT'),

  // Slack Config
  MAIN_CHANNEL: assertEnv('MAIN_CHANNEL'),
  DEV_CHANNEL: assertEnv('DEV_CHANNEL'),
  INTERNAL_CHANNEL: assertEnv('INTERNAL_CHANNEL'),

  PING_USERGROUP: assertEnv('PING_USERGROUP'),
  DEV_USERGROUP: assertEnv('DEV_USERGROUP'),

  // Control Flags
  PROD: (process.env.PROD === 'true'),
}

// Constants
export const Constants = {
  MIN_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,

  PUBLIC_DEV_CHANNEL: 'C0P5NE354',
};

// Commands
export const Commands = Environment.PROD ? {
  HACK: '/hack',
  HACK_ALIAS: '/hour',
  CANCEL: '/cancel',
  GOALS: '/goals',
  STATS: '/mystats',
  REMINDERS: '/reminders',
  EVENTS: '/picnics',
  INSTRUCTIONS: '/instructions'  
} : {
  HACK: '/ztesthack',
  HACK_ALIAS: '/testhour',
  CANCEL: '/testcancel',
  GOALS: '/testgoals',
  STATS: '/testmystats',
  REMINDERS: '/testreminders',
  EVENTS: '/testpicnics',
  INSTRUCTIONS: '/testinstructions'
};