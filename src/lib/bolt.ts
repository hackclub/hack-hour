import bolt from '@slack/bolt'; 
import bodyParser from 'body-parser';

import { Environment } from './constants.js';
import { emitter } from './emitter.js';

const expressReceiver = new bolt.ExpressReceiver({
    signingSecret: Environment.SLACK_SIGNING_SECRET,
    endpoints: '/slack/events',
    processBeforeResponse: true,
});

export const express = expressReceiver.app;

export const app = new bolt.App({
    token: Environment.SLACK_BOT_TOKEN,
    appToken: Environment.SLACK_APP_TOKEN,
    clientId: Environment.CLIENT_ID,
    clientSecret: Environment.CLIENT_SECRET,    

    receiver: expressReceiver,
});

express.use(bodyParser.json());

app.error(async (error) => {
    if (!error.original) {
        emitter.emit('error', error);
    } else {
        emitter.emit('error', error.original);
    }
});