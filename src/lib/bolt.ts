import bolt, { SlackViewAction, SlackViewMiddlewareArgs } from '@slack/bolt';
import bodyParser from 'body-parser';

import { AllMiddlewareArgs, Middleware, SlackAction, SlackActionMiddlewareArgs, SlackCommandMiddlewareArgs } from "@slack/bolt";
import { StringIndexed } from "@slack/bolt/dist/types/helpers.js";

import { Commands, Environment } from './constants.js';
import { emitter } from './emitter.js';
import { assertVal } from './assert.js';
import { t } from './templates.js';
import { AirtableAPI } from './airtable.js';

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
        emitter.emit('error', { error });
    } else {
        emitter.emit('error', { error });
        emitter.emit('error', { error: error.original });
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

export const recordCommands = [
    Commands.SHOP,
]

async function callSlackClient(asyncFunction: Function, ...args: any[]) {
    try {
        const now = new Date();

        console.log(`[${now.toISOString()}] calling Slack client method ${asyncFunction.name}`)

        const result = await asyncFunction(...args);

        assertVal(result);

        const diff = new Date().getTime() - now.getTime();

        console.log(`[${now.toISOString()}] Slack client method succeeded after ${diff}ms`)

        return result;
    } catch (error) {
        emitter.emit('error', { error });
    }

}

export const Slack = {
    auth: app.client.auth,
    users: app.client.users,
    async command(command: string, commandHandler: (payload: SlackCommandMiddlewareArgs & AllMiddlewareArgs<StringIndexed>) => void) {
        app.command(command, async (payload) => {
            const now = new Date();
            let verb = ""

            try {
                const { command: event, ack, respond } = payload;

                console.log(`[${now.toISOString()}] <@${event.user_id}> ran \`${command} ${event.text}\``)

                await ack();

                if (Environment.MAINTAINANCE_MODE) {
                    const user = await app.client.users.info({
                        user: event.user_id
                    });

                    if (!(approvedUsers.includes(event.user_id) || user.user?.profile?.guest_invited_by === "U078MRX71TJ")) {
                        return respond(t('maintanenceMode'))
                    }
                }

                if (recordCommands.includes(command) && Environment.PROD) {
                    const airtableUser = await AirtableAPI.User.lookupBySlack(event.user_id);

                    if (airtableUser) {
                        await AirtableAPI.User.update(airtableUser.id, {
                            [command]: true
                        });
                    }
                }

                if (Environment.VERBOSE) {
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
                    });
                }

                await commandHandler(payload);
                verb = "succeeded"
            } catch (error) {
                verb = "failed"
                emitter.emit('error', { error })

                payload.respond({
                    text: `An error occurred while processing your command!`,
                    response_type: "ephemeral"
                })
            }

            const duration = new Date().getTime() - now.getTime();
            console.log(`[${now.toISOString()}] ${verb} after ${duration}ms`)
        })
    },

    async action(actionId: string | RegExp, ...listeners: Middleware<SlackActionMiddlewareArgs<SlackAction>, StringIndexed>[]) {
        app.action(actionId, async (payload) => {
            const now = new Date();
            let verb = ""

            try {
                const { action, body, ack, respond } = payload;

                console.log(`[${now.toISOString()}] <@${body.user.id}> used ${action.type} "${actionId}"`)

                await ack();

                const user = await app.client.users.info({
                    user: body.user.id
                });

                if (!(approvedUsers.includes(body.user.id) || user.user?.profile?.guest_invited_by === "U078MRX71TJ") && Environment.MAINTAINANCE_MODE) {
                    return respond(t('maintanenceMode'))
                }

                if (Environment.VERBOSE) {
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
                }

                verb = "succeeded"
                listeners.forEach((listener) => {
                    try {
                        listener(payload)
                    } catch (error) {
                        verb = "failed"
                        emitter.emit('error', { error });
                    }
                });
            } catch (error) {
                verb = "failed"
                emitter.emit('error', { error });

                payload.respond({
                    text: `An error occurred while processing your action!`,
                    response_type: "ephemeral"
                })
            }

            const duration = new Date().getTime() - now.getTime();
            console.log(`[${now.toISOString()}] ${verb} after ${duration}ms`)
        })
    },

    async view(callbackId: string | RegExp, ...listeners: Middleware<SlackViewMiddlewareArgs<SlackViewAction>, StringIndexed>[]) {
        app.view(callbackId, async (payload) => {
            const now = new Date();
            let verb = "";

            const { body, ack } = payload;

            console.log(`[${now.toISOString()}] <@${body.user.id}> ${body.type === "view_submission" ? "submitted" : "closed"} view "${callbackId}"`);

            await ack();

            try {
                if (Environment.VERBOSE) {
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
                }

                verb = "succeeded"
                listeners.forEach((listener) => {
                    try {
                        listener(payload)
                    } catch (error) {
                        verb = "failed"
                        emitter.emit('error', { error });
                    }
                });
            } catch (error) {
                verb = "failed"
                emitter.emit('error', { error });

                payload.respond({
                    text: `An error occurred while processing your view!`,
                    response_type: "ephemeral"
                })
            }

            const duration = new Date().getTime() - now.getTime();
            console.log(`[${now.toISOString()}] ${verb} after ${duration}ms`)
        })
    },

    chat: {
        async delete(options: Parameters<typeof app.client.chat.delete>[0]) {
            try {
                const now = new Date();

                console.log(`[${now.toISOString()}] deleting message`)

                const result = assertVal(await app.client.chat.delete(options));

                const diff = new Date().getTime() - now.getTime();

                console.log(`[${now.toISOString()}] deleted message in ${diff}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
            }
        },
        async postMessage(options: Parameters<typeof app.client.chat.postMessage>[0]) {
            try {
                const now = new Date();

                if (options?.blocks) {
                    console.log(JSON.stringify(options.blocks))
                    // await app.client.chat.postMessage({
                    //     channel: Environment.INTERNAL_CHANNEL,
                    //     blocks: [
                    //         {
                    //             "type": "section",
                    //             "text": {
                    //                 "type": "mrkdwn",
                    //                 "text": `> _Sent a message with blocks_`
                    //             }
                    //         },
                    //         {
                    //             "type": "section",
                    //             "text": {
                    //                 "type": "mrkdwn",
                    //                 "text": `\`\`\`${JSON.stringify(options.blocks, null, 2)}\`\`\``
                    //             }
                    //         },
                    //         {
                    //             "type": "context",
                    //             "elements": [
                    //                 {
                    //                     "type": "mrkdwn",
                    //                     "text": `${new Date().toString()}`
                    //                 }
                    //             ]
                    //         }
                    //     ]
                    // });
                }

                const result = assertVal(await app.client.chat.postMessage(options));

                const duration = new Date().getTime() - now.getTime();
                console.log(`[${now.toISOString()}] posted message after ${duration}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
            }
        },

        async postEphemeral(options: Parameters<typeof app.client.chat.postEphemeral>[0]) {
            try {
                // await app.client.chat.postMessage({
                //     ...options,
                //     channel: Environment.INTERNAL_CHANNEL
                // });                
                const now = new Date();

                if (options?.blocks) {
                    console.log(JSON.stringify(options.blocks))
                    // await app.client.chat.postMessage({
                    //     channel: Environment.INTERNAL_CHANNEL,
                    //     blocks: [
                    //         {
                    //             "type": "section",
                    //             "text": {
                    //                 "type": "mrkdwn",
                    //                 "text": `> _Sent an ephemeral message with blocks_`
                    //             }
                    //         },
                    //         {
                    //             "type": "section",
                    //             "text": {
                    //                 "type": "mrkdwn",
                    //                 "text": `\`\`\`${JSON.stringify(options.blocks, null, 2)}\`\`\``
                    //             }
                    //         },
                    //         {
                    //             "type": "context",
                    //             "elements": [
                    //                 {
                    //                     "type": "mrkdwn",
                    //                     "text": `${new Date().toString()}`
                    //                 }
                    //             ]
                    //         }
                    //     ]
                    // });
                }

                const result = assertVal(await app.client.chat.postEphemeral(options));

                const duration = new Date().getTime() - now.getTime();
                console.log(`[${now.toISOString()}] posted ephemeral after ${duration}ms`)

                return result;
            } catch (error: any) {
                emitter.emit('error', { error });

                console.log(`[${new Date().toISOString()}] failed to post message`)

                // if (options) {
                //     await app.client.chat.postMessage({
                //         user: options.user,
                //         channel: Environment.INTERNAL_CHANNEL,
                //         text: `An error occurred! ${error.message}`
                //     });
                // }
            }
        },

        async update(options: Parameters<typeof app.client.chat.update>[0]) {
            try {
                // await app.client.chat.postMessage({
                //     text: `Updating message ${options.channel} ${options.ts}`,
                //     channel: Environment.INTERNAL_CHANNEL
                // });
                const now = new Date();

                console.log(`[${now.toISOString()}] updating message`)

                if (options?.blocks) {
                    console.log(JSON.stringify(options.blocks))
                    // await app.client.chat.postMessage({
                    //     channel: Environment.INTERNAL_CHANNEL,
                    //     blocks: [
                    //         {
                    //             "type": "section",
                    //             "text": {
                    //                 "type": "mrkdwn",
                    //                 "text": `> _Updated a message with blocks_`
                    //             }
                    //         },
                    //         {
                    //             "type": "section",
                    //             "text": {
                    //                 "type": "mrkdwn",
                    //                 "text": `\`\`\`${JSON.stringify(options.blocks, null, 2)}\`\`\``
                    //             }
                    //         },
                    //         {
                    //             "type": "context",
                    //             "elements": [
                    //                 {
                    //                     "type": "mrkdwn",
                    //                     "text": `${new Date().toString()}`
                    //                 }
                    //             ]
                    //         }
                    //     ]
                    // });
                }

                const result = assertVal(await app.client.chat.update(options));

                const diff = new Date().getTime() - now.getTime();

                console.log(`[${now.toISOString()}] updated message in ${diff}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
            }
        },

        async getPermalink(options: Parameters<typeof app.client.chat.getPermalink>[0]) {
            try {
                const now = new Date();

                console.log(`[${now.toISOString()}] getting permalink`)

                const result = assertVal(await app.client.chat.getPermalink(options));

                const diff = new Date().getTime() - now.getTime();

                console.log(`[${now.toISOString()}] got permalink in ${diff}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
            }
        }
    },

    views: {
        async open(options: Parameters<typeof app.client.views.open>[0]) {
            try {
                const now = new Date();

                if (!options) { throw new Error('No options provided!') }

                console.log(`[${now.toISOString()}] opening view"`)

                const result = await app.client.views.open(options);

                console.log(`[${now.toISOString()}] succeeded after ${new Date().getTime() - now.getTime()}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
            }
        },

        async update(options: Parameters<typeof app.client.views.update>[0]) {
            try {
                const now = new Date();

                if (!options) { throw new Error('No options provided!') }

                console.log(`[${now.toISOString()}] updating view`)

                const result = await app.client.views.update(options);

                console.log(`[${now.toISOString()}] succeeded after ${new Date().getTime() - now.getTime()}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
            }
        },

        async push(options: Parameters<typeof app.client.views.push>[0]) {
            try {
                const now = new Date();

                if (!options) { throw new Error('No options provided!') }

                console.log(`[${now.toISOString()}] pushing view`)

                const result = await app.client.views.push(options);

                console.log(`[${now.toISOString()}] succeeded after ${new Date().getTime() - now.getTime()}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
            }
        }
    },

    reactions: {
        async add(options: Parameters<typeof app.client.reactions.add>[0]) {
            try {
                const now = new Date();

                console.log(`[${now.toISOString()}] adding reaction`);

                const result = assertVal(await app.client.reactions.add(options));

                const diff = new Date().getTime() - now.getTime();

                console.log(`[${now.toISOString()}] added reaction in ${diff}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
            }
        }
    },

    conversations: {
        async members({
            channelID,
            nextCursor
        }:  {channelID: string, nextCursor?: string}): Promise<string[]> {
            try {
                const request = await app.client.conversations.members({limit: 100, channel: channelID, cursor: nextCursor});
                const members = request.members || [];
                let nextMembers: string[] = []
                if (request.response_metadata?.next_cursor) {
                    nextMembers = await Slack.conversations.members({channelID, nextCursor: request.response_metadata.next_cursor});
                }
                return [...members, ...nextMembers]

            } catch (error) {
                emitter.emit('error', { error });
                return []
            }
        },
        async info(channelID: string) {
            try {
                const now = new Date();

                console.log(`[${now.toISOString()}] fetching channel info`);

                const result = assertVal(await app.client.conversations.info({ channel: channelID }));

                const diff = new Date().getTime() - now.getTime();

                console.log(`[${now.toISOString()}] fetched channel info in ${diff}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
            }
        },
        async replies(options: Parameters<typeof app.client.conversations.replies>[0]) {
            try {
                const now = new Date();

                console.log(`[${now.toISOString()}] fetching replies`);

                const result = assertVal(await app.client.conversations.replies(options));

                const diff = new Date().getTime() - now.getTime();

                console.log(`[${now.toISOString()}] fetched replies in ${diff}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
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
        if (Environment.VERBOSE) {
            await app.client.chat.postMessage({
                channel: Environment.INTERNAL_CHANNEL,
                text: message.slice(0, 3000),
                blocks: [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": `> ${message.slice(0, 3000)}`
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
}

await Slack.helper.ensureChannels();