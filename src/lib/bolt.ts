import bolt, { SlackViewAction, SlackViewMiddlewareArgs } from '@slack/bolt'; 
import bodyParser from 'body-parser';

import { AllMiddlewareArgs, Middleware, SlackAction, SlackActionMiddlewareArgs, SlackCommandMiddlewareArgs } from "@slack/bolt";
import { StringIndexed } from "@slack/bolt/dist/types/helpers.js";

import { Environment } from './constants.js';
import { emitter } from './emitter.js';
import { assertVal } from './assert.js';
import { t } from './templates.js';

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

// while working on the bot, only allow the dev team to use the bot
export const approvedUsers = [
    'U0C7B14Q3',
    'U04QD71QWS0',
    'UDK5M9Y13',
    'U078MRX71TJ',
    'U0777CCQQCF',
    'U05NX48GL3T',
    'U078ACL01S7',
    'U078ZCAHCNL',
    'U078ZDVC7CY',
    'U078D5YH5NG',
    'U0787QYQM53',
    'U078BK769BL',
    'U077XBJ3YPR',
]

export const Slack = {
    async command(command: string, commandHandler: (payload: SlackCommandMiddlewareArgs & AllMiddlewareArgs<StringIndexed>) => void) {
        app.command(command, async (payload) => {
            const { command: event, ack, respond } = payload;
    
            await ack();

            const user = await app.client.users.info({
                user: event.user_id
            });

            if (!(approvedUsers.includes(event.user_id) || user.user?.profile?.guest_invited_by === "U078MRX71TJ") && Environment.MAINTAINANCE_MODE) {
                return respond(t('maintanenceMode', {}))
            }

            try {
                await app.client.chat.postMessage({
                    channel: Environment.INTERNAL_CHANNEL,
                    blocks: [
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": `> _<@${event.user_id}> ran \`${command} ${event.text}\`_`
                            }
                        },
                        {
                            type: "context",
                            elements: [
                                {
                                    type: "mrkdwn",
                                    text: `${command} - ran in <#${event.channel_id}>\n${new Date().toString()}`,
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
            const { action, body, ack, respond } = payload;

            const user = await app.client.users.info({
                user: body.user.id
            });

            if (!(approvedUsers.includes(body.user.id) || user.user?.profile?.guest_invited_by === "U078MRX71TJ") && Environment.MAINTAINANCE_MODE) {
                return respond(t('maintanenceMode', {}))
            }

            try {
                await app.client.chat.postMessage({
                    channel: Environment.INTERNAL_CHANNEL,
                    blocks: [
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": `> _<@${body.user.id}> used ${action.type} "${actionId}"_`
                            }
                        },
                        {
                            type: "context",
                            elements: [
                                {
                                type: "mrkdwn",
                                text: `${actionId} - ran in <#${body.channel?.id}>\n${new Date().toString()}`,
                                },
                            ],
                        },
                    ]                    
                    // blocks: [
                    //     {
                    //         type: "context",
                    //         elements: [
                    //             {
                    //             type: "mrkdwn",
                    //             text: `${actionId} ${action.type}`,
                    //             },
                    //         ],
                    //     },
                    // ]
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
            const { body, view } = payload;

            try {
                await app.client.chat.postMessage({
                    channel: Environment.INTERNAL_CHANNEL,
                    blocks: [
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": `> _<@${body?.user?.id}> ${body.type === "view_submission" ? "submitted" : "closed"} view ${callbackId}_`
                            }
                        },
                        {
                            type: "context",
                            elements: [
                                {
                                type: "mrkdwn",
                                text: `${callbackId}\n${new Date().toString()} `,
                                },
                            ],
                        },
                    ]                                     
                    // blocks: [
                    //     {
                    //         type: "context",
                    //         elements: [
                    //             {
                    //             type: "mrkdwn",
                    //             text: `${callbackId} ${view.callback_id}`,
                    //             },
                    //         ],
                    //     },
                    // ]
                })

                listeners.forEach((listener) => listener(payload));
            } catch (error) {
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
                // await app.client.chat.postMessage({
                //     ...options,
                //     channel: Environment.INTERNAL_CHANNEL
                // });
                return assertVal(await app.client.chat.postMessage(options));
            } catch (error) {
                emitter.emit('error', error);
            }
        },

        async postEphemeral(options: Parameters<typeof app.client.chat.postEphemeral>[0]) {
            try {
                // await app.client.chat.postMessage({
                //     ...options,
                //     channel: Environment.INTERNAL_CHANNEL
                // });                
                return assertVal(await app.client.chat.postEphemeral(options));
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
                // await app.client.chat.postMessage({
                //     text: `Updating message ${options.channel} ${options.ts}`,
                //     channel: Environment.INTERNAL_CHANNEL
                // });
                return assertVal(await app.client.chat.update(options));
            } catch (error) {
                emitter.emit('error', error);
            }
        }
    },

    reactions: {
        async add(options: Parameters<typeof app.client.reactions.add>[0]) {
            try {
                // await app.client.chat.postMessage({
                //     text: `Adding reaction to message ${options.channel} ${options.timestamp}`,
                //     channel: Environment.INTERNAL_CHANNEL
                // });
                return assertVal(await app.client.reactions.add(options));
            } catch (error) {
                emitter.emit('error', error);
            }
        }
    },

    helper: {
        async ensureChannels() {
            await app.client.conversations.join({
                channel: Environment.MAIN_CHANNEL
            });

            return;            
        }
    },

    async slog(message: string) {
        await app.client.chat.postMessage({
            channel: Environment.INTERNAL_CHANNEL,
            text: message,
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `> ${message}`
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": `${new Date().toString()}`
                        }
                    ]
                }
            ]
        });
    }
}

await Slack.helper.ensureChannels();