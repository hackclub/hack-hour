import bolt, { SlackEventMiddlewareArgs, SlackViewAction, SlackViewMiddlewareArgs } from '@slack/bolt';
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

export const buggedUsers = [
    'U0794S6UVCM'
]

export const recordCommands = [
    Commands.SHOP,
]

async function callSlackClient<T extends (...args: any[]) => Promise<any>>(asyncFunction: T, ...args: Parameters<T>): Promise<ReturnType<T> | undefined> {
    try {
        const now = new Date();

        console.log(`[${asyncFunction.name}] calling Slack client method ${asyncFunction.name}`)

        const result = asyncFunction(...args) 
            .then((result) => result)
            .catch((error) => {
                console.error(error);
            });
 
        const diff = new Date().getTime() - now.getTime();

        console.log(`[${asyncFunction.name}] Slack client method succeeded after ${diff}ms`)

        return result;
    } catch (error) {
        console.error(error);
    }
}

export const Slack = {
    auth: {
        ...app.client.auth
    },
    users: app.client.users,
    async command(command: string, commandHandler: (payload: SlackCommandMiddlewareArgs & AllMiddlewareArgs<StringIndexed>) => void) {
        app.command(command, async (payload) => {
            const now = new Date();
            let verb = ""

            try {
                const { command: event, ack, respond } = payload;

                console.log(`[app.command] <@${event.user_id}> ran \`${command} ${event.text}\``)

                await ack();

                if (Environment.MAINTAINANCE_MODE) {
                    const user = await app.client.users.info({
                        user: event.user_id
                    });

                    if (!(approvedUsers.includes(event.user_id) || user.user?.profile?.guest_invited_by === "U078MRX71TJ")) {
                        return respond(t('maintanenceMode'))
                    }
                }

                if (buggedUsers.includes(event.user_id)) {
                    return respond(t('maintanenceMode'))
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
            console.log(`[app.command] ${verb} after ${duration}ms`)
        })
    },

    async action(actionId: string | RegExp, ...listeners: Middleware<SlackActionMiddlewareArgs<SlackAction>, StringIndexed>[]) {
        app.action(actionId, async (payload) => {
            const now = new Date();
            let verb = ""

            try {
                const { action, body, ack, respond } = payload;

                console.log(`[app.action] <@${body.user.id}> used ${action.type} "${actionId}"`)

                await ack();

                const user = await app.client.users.info({
                    user: body.user.id
                });

                if (!(approvedUsers.includes(body.user.id) || user.user?.profile?.guest_invited_by === "U078MRX71TJ") && Environment.MAINTAINANCE_MODE) {
                    return respond(t('maintanenceMode'))
                }

                if (buggedUsers.includes(body.user.id)) {
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
            console.log(`[app.action] ${verb} after ${duration}ms`)
        })
    },

    async view(callbackId: string | RegExp, ...listeners: Middleware<SlackViewMiddlewareArgs<SlackViewAction>, StringIndexed>[]) {
        app.view(callbackId, async (payload) => {
            const now = new Date();
            let verb = "";

            const { body, ack } = payload;

            console.log(`[app.view] <@${body.user.id}> ${body.type === "view_submission" ? "submitted" : "closed"} view "${callbackId}"`);

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
            console.log(`[app.view] ${verb} after ${duration}ms`)
        })
    },

    async event<T extends string>(event: T, ...listeners: Middleware<SlackEventMiddlewareArgs<T>, StringIndexed>[]) {
        app.event(event, async (payload) => {
            const now = new Date();
            let verb = ""

            try {
                const { event } = payload;

                console.log(`[app.event] received event "${event.type}"`)

                if (Environment.VERBOSE) {
                    await app.client.chat.postMessage({
                        channel: Environment.INTERNAL_CHANNEL,
                        blocks: [
                            {
                                "type": "section",
                                "text": {
                                    "type": "mrkdwn",
                                    "text": `> _Received event "${event.type}"_`
                                }
                            },
                            {
                                type: "context",
                                elements: [
                                    {
                                        type: "mrkdwn",
                                        text: `${event.type}\n${new Date().toString()} `,
                                    },
                                ],
                            },
                        ]
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
            }

            const duration = new Date().getTime() - now.getTime();
            console.log(`[app.event] ${verb} after ${duration}ms`)
        })
    },

    chat: {
        async delete(options: Parameters<typeof app.client.chat.delete>[0]) {
            if (options) { options!.token = Environment.ADMIN_TOKEN };

            return await assertVal(await callSlackClient(app.client.chat.delete, options));
        },

        async postMessage(options: Parameters<typeof app.client.chat.postMessage>[0]) {
            if (options?.blocks) {
                console.log('[Blocks]', JSON.stringify(options.blocks))
            }
            return await assertVal(await callSlackClient(app.client.chat.postMessage, options));
        },

        async postEphemeral(options: Parameters<typeof app.client.chat.postEphemeral>[0]) {
            if (options?.blocks) {
                console.log('[Blocks]', JSON.stringify(options.blocks))
            }
            return await assertVal(await callSlackClient(app.client.chat.postEphemeral, options));
        },

        async update(options: Parameters<typeof app.client.chat.update>[0]) {
            if (options?.blocks) {
                console.log('[Blocks]', JSON.stringify(options.blocks))
            }
            return await assertVal(await callSlackClient(app.client.chat.update, options));
        },

        async getPermalink(options: Parameters<typeof app.client.chat.getPermalink>[0]) {
            return await assertVal(await callSlackClient(app.client.chat.getPermalink, options));
        }
    },

    views: {
        async open(options: Parameters<typeof app.client.views.open>[0]) {
            try {
                const now = new Date();

                if (!options) { throw new Error('No options provided!') }

                console.log(`[views.open] opening view`)

                const result = await app.client.views.open(options);

                console.log(`[views.open] succeeded after ${new Date().getTime() - now.getTime()}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
            }
        },

        async update(options: Parameters<typeof app.client.views.update>[0]) {
            try {
                const now = new Date();

                if (!options) { throw new Error('No options provided!') }

                console.log(`[views.update] updating view`)

                const result = await app.client.views.update(options);

                console.log(`[views.update] succeeded after ${new Date().getTime() - now.getTime()}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
            }
        },

        async push(options: Parameters<typeof app.client.views.push>[0]) {
            try {
                const now = new Date();

                if (!options) { throw new Error('No options provided!') }

                console.log(`[views.push] pushing view`)

                const result = await app.client.views.push(options);

                console.log(`[views.push] succeeded after ${new Date().getTime() - now.getTime()}ms`)

                return result;
            } catch (error) {
                emitter.emit('error', { error });
            }
        }
    },

    reactions: {
        async add(options: Parameters<typeof app.client.reactions.add>[0]) {
            try {
                return await assertVal(await callSlackClient(app.client.reactions.add, options))
            } catch (error) {
                console.error(error);
            }
        },

        async remove(options: Parameters<typeof app.client.reactions.remove>[0]) {
            try {
                return await assertVal(await callSlackClient(app.client.reactions.remove, options))
            } catch (error) {
                console.error(error);
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
            return await assertVal(await callSlackClient(app.client.conversations.info, { channel: channelID }));
        },

        async replies(options: Parameters<typeof app.client.conversations.replies>[0]) {
            return await assertVal(await callSlackClient(app.client.conversations.replies, options));
        }
    },

    helper: {
        async ensureChannels() {
            await app.client.conversations.join({
                channel: Environment.MAIN_CHANNEL
            });

            await app.client.conversations.join({
                channel: "C07AXU6FCC8" // #arcade-bulletin
            });

            await app.client.conversations.join({
                channel: "C07AQ75CWQJ" // #arcade-shoutouts
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

try {
    await Slack.helper.ensureChannels();
} catch (error) {
    console.error(`[Error] Failed to ensure channels`)
    console.error('[Error]', error)
}