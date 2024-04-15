import bolt from '@slack/bolt'; 
import { PrismaClient } from '@prisma/client';
import { IntervalManager } from './utils/intervalManager.js';
import { Environment, Constants } from './constants.js';

export const app = new bolt.App({
    token: Environment.SLACK_BOT_TOKEN,
    appToken: Environment.SLACK_APP_TOKEN,
    signingSecret: Environment.SLACK_SIGNING_SECRET,

    socketMode: Environment.SOCKET_MODE
});

export const prisma = new PrismaClient();

export const minuteInterval = new IntervalManager(Constants.MIN_MS);
export const hourInterval = new IntervalManager(Constants.HOUR_MS);