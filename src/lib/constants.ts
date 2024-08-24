import { assertEnv } from "./assert.js";

export const Environment = {
    // Server/Slack App
    SLACK_APP_TOKEN: assertEnv('SLACK_APP_TOKEN'),
    SLACK_BOT_TOKEN: assertEnv('SLACK_BOT_TOKEN'),
    SLACK_SIGNING_SECRET: assertEnv('SLACK_SIGNING_SECRET'),

    ADMIN_TOKEN: assertEnv('ADMIN_TOKEN'),

    CLIENT_ID: assertEnv('CLIENT_ID'),
    CLIENT_SECRET: assertEnv('CLIENT_SECRET'),

    PORT: assertEnv('PORT'),

    // Slack Config
    MAIN_CHANNEL: assertEnv('MAIN_CHANNEL'),
    DEV_CHANNEL: assertEnv('DEV_CHANNEL'),
    INTERNAL_CHANNEL: assertEnv('INTERNAL_CHANNEL'),

    SCRAPBOOK_CHANNEL: assertEnv('SCRAPBOOK_CHANNEL'),
    // SHIP_CHANNEL: assertEnv('SHIP_CHANNEL'),

    REVIEW_CHANNEL: assertEnv('REVIEW_CHANNEL'),

    // PING_USERGROUP: assertEnv('PING_USERGROUP'),
    DEV_USERGROUP: assertEnv('DEV_USERGROUP'),

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
    API: '/api',
    SHOWCASE: '/showcase'
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
    API: '/testapi',
    SHOWCASE: '/testshowcase'
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

    NO_ACTION: 'noaction',

    SESSIONS: 'sessions-NIL',

    SESSIONS_PREVIOUS: 'sessionsprevious',
    SESSIONS_NEXT: 'sessionsnext',

    START_REVIEW: 'startreview',
    
    APPROVE: 'approve',
    APPROVEMIN: 'approvemin',
    APPROVEMIN100: 'approvemin100',
    APPROVEMIN75: 'approvemin75',
    APPROVEMIN50: 'approvemin50',
    APPROVEMIN25: 'approvemin25',

    REJECT: 'reject',
    REJECT_LOCK: 'rejectlock',
    UNDO: 'undo',
    UNSUBMIT: 'unsubmit',
    MAGIC: 'magic',

    NEXT_REVIEW: 'nextreview',
    SHIP: 'ship',
    WIP: 'wip',

    OPEN_SHOWCASE: 'openshowcase',
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

export const Channels = {
    
}