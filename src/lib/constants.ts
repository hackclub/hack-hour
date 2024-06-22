import { assertEnv } from "./assert.js";

export const Environment = {
  // Server/Slack App
  SLACK_APP_TOKEN: assertEnv('SLACK_APP_TOKEN'),
  SLACK_BOT_TOKEN: assertEnv('SLACK_BOT_TOKEN'),
  SLACK_SIGNING_SECRET: assertEnv('SLACK_SIGNING_SECRET'),

  CLIENT_ID: assertEnv('CLIENT_ID'),
  CLIENT_SECRET: assertEnv('CLIENT_SECRET'),

  PORT: assertEnv('PORT'),

  // Slack Config
  MAIN_CHANNEL: assertEnv('MAIN_CHANNEL'),
  DEV_CHANNEL: assertEnv('DEV_CHANNEL'),
  INTERNAL_CHANNEL: assertEnv('INTERNAL_CHANNEL'),

  SHIP_CHANNEL: assertEnv('SHIP_CHANNEL'),

  PING_USERGROUP: assertEnv('PING_USERGROUP'),
  DEV_USERGROUP: assertEnv('DEV_USERGROUP'),

  SCRAPBOOK_CHANNEL: assertEnv('SCRAPBOOK_CHANNEL'),

  // Control Flags
  PROD: (process.env.PROD === 'true'),
  ARCADE: (process.env.ARCADE === 'true'),

  MAINTAINANCE_MODE: (process.env.MAINTAINANCE_MODE === 'true'),

  // Arcade Config
  ARCADIUS_URL: assertEnv('ARCADIUS_URL'),
  ARCADIUS_SECRET: assertEnv('ARCADIUS_SECRET'),
  SHOP_URL: assertEnv('SHOP_URL'),

  VERBOSE: (process.env.VERBOSE === 'true'),
};

// Constants
export const Constants = {
  MIN_MS: 60 * 1000,
//  MIN_MS: 1 * 1000,
  HOUR_MS: 60 * 60 * 1000,

  PROMOTION_THRESH: 3 * 60, // 3 hours

  PUBLIC_DEV_CHANNEL: 'C0P5NE354',

  AUTO_CANCEL: 60,

  USERNAME: 'hakkuun'
};

// Commands
export const Commands = Environment.PROD ? {
  PAUSE: '/pause',
  START: '/start',
  EXTEND: '/extend',
  CANCEL: '/cancel',
  HACK: '/hack',
  STATS: '/mystats',
  SESSIONS: '/sessions',
  SHOP: '/shop',
  HOUR: '/hour',
  ARCADE: '/arcade',
  ADMIN: '/admin',
  /*
  GOALS: '/goals',
  STATS: '/mystats',
  REMINDERS: '/reminders',
  EVENTS: '/picnics',
  INSTRUCTIONS: '/instructions'  
  */
} : {
  PAUSE: '/testpause',
  START: '/teststart',
  EXTEND: '/testextend',
  CANCEL: '/testcancel',
  HACK: '/testhack',
  STATS: '/teststats',
  SESSIONS: '/testsessions',
  SHOP: '/testshop',
  HOUR: '/testhour',
  ARCADE: '/testarcade',
  ADMIN: '/testadmin',
  /*
  GOALS: '/testgoals',
  STATS: '/testmystats',
  REMINDERS: '/testreminders',
  EVENTS: '/testpicnics',
  INSTRUCTIONS: '/testinstructions'
  */
};

export const Actions = {
  PAUSE: 'pause',
  RESUME: 'resume',
  EXTEND: 'extend',
  CANCEL: 'cancel',

  OPEN_GOAL: 'opengoal',
  SELECT_GOAL: 'selectgoal',
  CREATE_GOAL: 'creategoal',
  DELETE_GOAL: 'deletegoal',

  VIEW_STATS: 'viewstats',

  ATTACH_REPO: 'attachrepo',

  CHOOSE_SESSIONS: 'choosesessions',

  HACK: 'hack',

  TUTORIAL_ADVANCE: 'tutorialadvance',
  TUTORIAL_BACK: 'tutorialback',

  OPEN_SHOP: 'openshop',

  EXISTING_USER_FIRST_TIME: 'existinguserfirsttime',
};

export const Callbacks = {
//  EXTEND_HOUR: 'extendhour',

  MAIN_GOAL: 'maingoal',
  CREATE_GOAL: 'callback_creategoal',
  DELETE_GOAL: 'callback_deletegoal',

  STATS: 'stats',

  CANCEL: 'cancel',

  ATTACH_REPO: 'attachrepo',

  CHOOSE_SESSIONS: 'choosesessions',
};