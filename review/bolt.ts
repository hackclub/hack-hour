import bolt, { SlackViewAction, SlackViewMiddlewareArgs } from '@slack/bolt';

import { AllMiddlewareArgs, Middleware, SlackAction, SlackActionMiddlewareArgs, SlackCommandMiddlewareArgs } from "@slack/bolt";
import { StringIndexed } from "@slack/bolt/dist/types/helpers.js";

import { assertVal, Channels, Environment } from './constants.js';

export const app = new bolt.App({
    token: Environment.SLACK_BOT_TOKEN,
    signingSecret: Environment.SLACK_SIGNING_SECRET
});

app.error(async (error) => {
    if (!error.original) {
        console.error(error);
    } else {
        console.error(error);
        console.error(error.original);
    }
});

async function callSlackClient<T extends (...args: any[]) => any>(asyncFunction: T, ...args: Parameters<T>): Promise<ReturnType<T> | undefined> {
    try {
        const now = new Date();

        console.log(`[${now.toISOString()}] calling Slack client method ${asyncFunction.name}`)

        const result = await asyncFunction(...args);
 
        const diff = new Date().getTime() - now.getTime();

        console.log(`[${now.toISOString()}] Slack client method succeeded after ${diff}ms`)

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

                console.log(`[${now.toISOString()}] <@${event.user_id}> ran \`${command} ${event.text}\``)

                await ack();

                await commandHandler(payload);
                verb = "succeeded"
            } catch (error) {
                verb = "failed"

                console.error(error);

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

                verb = "succeeded"
                listeners.forEach((listener) => {
                    try {
                        listener(payload)
                    } catch (error) {
                        verb = "failed"
                        console.error(error);
                    }
                });
            } catch (error) {
                verb = "failed"

                console.error(error);

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
                verb = "succeeded"
                listeners.forEach((listener) => {
                    try {
                        listener(payload)
                    } catch (error) {
                        verb = "failed"
                        console.error(error);
                    }
                });
            } catch (error) {
                verb = "failed"

                console.error(error);

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
            if (options) { options.token = Environment.ADMIN_TOKEN };

            return await assertVal(await callSlackClient(app.client.chat.delete, options));
        },

        async postMessage(options: Parameters<typeof app.client.chat.postMessage>[0]) {
            if (options?.blocks) {
                console.log(JSON.stringify(options.blocks))
            }
            return await assertVal(await callSlackClient(app.client.chat.postMessage, options));
        },

        async postEphemeral(options: Parameters<typeof app.client.chat.postEphemeral>[0]) {
            if (options?.blocks) {
                console.log(JSON.stringify(options.blocks))
            }
            return await assertVal(await callSlackClient(app.client.chat.postEphemeral, options));
        },

        async update(options: Parameters<typeof app.client.chat.update>[0]) {
            if (options?.blocks) {
                console.log(JSON.stringify(options.blocks))
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

                console.log(`[${now.toISOString()}] opening view"`)

                const result = await app.client.views.open(options);

                console.log(`[${now.toISOString()}] succeeded after ${new Date().getTime() - now.getTime()}ms`)

                return result;
            } catch (error) {
                console.error(error);
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
                console.error(error);
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
                console.error(error);
            }
        }
    },

    reactions: {
        async add(options: Parameters<typeof app.client.reactions.add>[0]) {
            return await assertVal(await callSlackClient(app.client.reactions.add, options));
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
                console.error(error);
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
            for (const channel of Object.values(Channels)) {
                console.log(`Ensuring channel ${channel} exists...`);

                if (!channel) {
                    throw new Error(`Channel ${channel} is not defined!`);
                }

                const info = await app.client.conversations.info({
                    channel
                }).catch((error) => { console.error(error); return { ok: false } });

                if (!info.ok) {
                    throw new Error(`Channel ${channel} does not exist!`);
                }
            }
            
            return;
        }
    },
}

await Slack.helper.ensureChannels();