import bolt, { SlackViewAction, SlackViewMiddlewareArgs } from '@slack/bolt'; 
import bodyParser from 'body-parser';

import { AllMiddlewareArgs, Middleware, SlackAction, SlackActionMiddlewareArgs, SlackCommandMiddlewareArgs } from "@slack/bolt";
import { StringIndexed } from "@slack/bolt/dist/types/helpers.js";

import { Environment } from './constants.js';
import { emitter } from './emitter.js';
import { assert } from 'console';

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

export const Slack = {
    async command(command: string, commandHandler: (payload: SlackCommandMiddlewareArgs & AllMiddlewareArgs<StringIndexed>) => void) {
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
    },

    async action(actionId: string | RegExp, ...listeners: Middleware<SlackActionMiddlewareArgs<SlackAction>, StringIndexed>[]) {
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
    },

    async view(callbackId: string | RegExp, ...listeners: Middleware<SlackViewMiddlewareArgs<SlackViewAction>, StringIndexed>[]) {
        app.view(callbackId, async (payload) => {
            const { ack, body, view } = payload;
    
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
                                text: `${callbackId} ${view.callback_id}`,
                                },
                            ],
                        },
                    ]
                })

                listeners.forEach((listener) => listener(payload));
            } catch(error) {
                emitter.emit('error', error);

                await app.client.chat.postEphemeral({
                    channel: body.user.id,
                    user: body.user.id,
                    text: `An error occurred while processing your view!`
                });
            }
        })
    },

    chat: {
        async postMessage(options: Parameters<typeof app.client.chat.postMessage>[0]) {
            try {
                await app.client.chat.postMessage({
                    ...options,
                    channel: Environment.INTERNAL_CHANNEL
                });
                return assert(await app.client.chat.postMessage(options));
            } catch (error) {
                emitter.emit('error', error);
            }
        },

        async postEphemeral(options: Parameters<typeof app.client.chat.postEphemeral>[0]) {
            try {
                await app.client.chat.postMessage({
                    ...options,
                    channel: Environment.INTERNAL_CHANNEL
                });                
                return assert(await app.client.chat.postEphemeral(options));
            } catch (error: any) {
                emitter.emit('error', error);
                if (options) {
                    await app.client.chat.postMessage({
                        user: options.user,
                        channel: Environment.INTERNAL_CHANNEL,
                        text: `An error occurred! ${error.message}`
                    });
                }
            }
        },

        async update(options: Parameters<typeof app.client.chat.update>[0]) {
            try {
                if (!options) { throw new Error('No options provided!') }
                await app.client.chat.postMessage({
                    text: `Updating message ${options.channel} ${options.ts}`,
                    channel: Environment.INTERNAL_CHANNEL
                });
                return assert(await app.client.chat.update(options));
            } catch (error) {
                emitter.emit('error', error);
            }
        }
    },

    reactions: {
        async add(options: Parameters<typeof app.client.reactions.add>[0]) {
            try {
                if (!options) { throw new Error('No options provided!') }
                await app.client.chat.postMessage({
                    text: `Adding reaction to message ${options.channel} ${options.timestamp}`,
                    channel: Environment.INTERNAL_CHANNEL
                });
                return await app.client.reactions.add(options);
            } catch (error) {
                emitter.emit('error', error);
            }
        }
    },

    helper: {
        async ensureChannels() {
            // TODO
            return;            
        }
    }
}