import bolt from '@slack/bolt'; 
import bodyParser from 'body-parser';

import { AllMiddlewareArgs, Middleware, SlackAction, SlackActionMiddlewareArgs, SlackCommandMiddlewareArgs } from "@slack/bolt";
import { StringIndexed } from "@slack/bolt/dist/types/helpers.js";

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

export class BoltWrapper {
    public static async command(command: string, commandHandler: (payload: SlackCommandMiddlewareArgs & AllMiddlewareArgs<StringIndexed>) => void) {
        app.command(command, async (payload) => {
            const { command: event, ack, respond } = payload;
    
            await ack();
    
            try {
                await app.client.chat.postMessage({
                    channel: Environment.INTERNAL_CHANNEL,
                    blocks: [
                        {
                        type: "context",
                        elements: [
                            {
                            type: "mrkdwn",
                            text: `${command} ${event.text}`,
                            },
                        ],
                        },
                    ]
                })
                commandHandler(payload);
            } catch(error) {
                emitter.emit('error', error)

                await app.client.chat.postEphemeral({
                    channel: event.channel_id,
                    user: event.user_id,
                    text: `An error occurred while processing your command!`
                })
            }
        })
    }

    public static async action(actionId: string | RegExp, ...listeners: Middleware<SlackActionMiddlewareArgs<SlackAction>, StringIndexed>[]) {
        app.action(actionId, async (payload) => {
            const { action, ack, respond } = payload;
    
            await ack();
    
            try {
                await app.client.chat.postMessage({
                    channel: Environment.INTERNAL_CHANNEL,
                    blocks: [
                        {
                            type: "context",
                            elements: [
                                {
                                type: "mrkdwn",
                                text: `${actionId} ${action.type}`,
                                },
                            ],
                        },
                    ]
                })

                listeners.forEach((listener) => listener(payload));
            } catch(error) {
                emitter.emit('error', error);

 /*               await app.client.chat.postEphemeral({
                    channel: action.channel.id,
                    user: action.user.id,
                    text: `An error occurred while processing your action!`
                });*/
            }
        })
    }
}