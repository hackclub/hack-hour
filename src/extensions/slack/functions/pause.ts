/*
Pause Management
*/
import { Slack } from "../../../lib/bolt.js";
import { Environment, Actions, Commands } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { emitter } from "../../../lib/emitter.js";
import { Session } from "../../../lib/corelib.js";

import { fetchSlackId, informUser } from "../lib/lib.js";

// TODO: Move to a standard library

Slack.action(Actions.PAUSE, async ({ ack, body }) => {
    try {
        await ack();

        const slackId = body.user.id;

        const session = await prisma.session.findFirst({
            where: {
                messageTs: (body as any).message.thread_ts,
                completed: false,
                cancelled: false,
                paused: false
            }
        });

        if (!session) {
            // Send an ephemeral message to the actor
            await Slack.chat.postEphemeral({
                user: slackId,
                channel: Environment.MAIN_CHANNEL,
                text: `You cannot pause another user's session!`,
                thread_ts: (body as any).message.thread_ts
            });                

            return;
        }

        const slackOwnerId = await fetchSlackId(session.userId);

        if (slackId !== slackOwnerId) {
            // Send an ephemeral message to the actor
            await Slack.chat.postEphemeral({
                user: slackId,
                channel: Environment.MAIN_CHANNEL,
                text: `You cannot pause another user's session!`,
                thread_ts: (body as any).message.thread_ts
            });                

            return;
        }

        await Session.pause(session);
    } catch (error) {
        emitter.emit('error', error);
    }
});

Slack.action(Actions.RESUME, async ({ ack, body }) => {
    try {
        await ack();

        const slackId = body.user.id;

        const session = await prisma.session.findFirst({
            where: {
                messageTs: (body as any).message.thread_ts,
                completed: false,
                cancelled: false,
                paused: true
            }
        });

        if (!session) {
            // Send an ephemeral message to the actor
            await Slack.chat.postEphemeral({
                user: slackId,
                channel: Environment.MAIN_CHANNEL,
                text: `You cannot resume another user's session!`,
                thread_ts: (body as any).message.thread_ts
            });                

            return;
        }

        const slackOwnerId = await fetchSlackId(session.userId);

        if (slackId !== slackOwnerId) {
            // Send an ephemeral message to the actor
            await Slack.chat.postEphemeral({
                user: slackId,
                channel: Environment.MAIN_CHANNEL,
                text: `You cannot resume another user's session!`,
                thread_ts: (body as any).message.thread_ts
            });                

            return;
        }

        await Session.pause(session);
    } catch (error) {
        emitter.emit('error', error);
    }
});

// Can toggle
Slack.command(Commands.PAUSE, async ({ ack, body }) => {
    try {
        const slackId = body.user_id;

        const session = await prisma.session.findFirst({
            where: {
                user: {
                    slackUser: {
                        slackId
                    }
                },
                completed: false,
                cancelled: false,
            }
        });

        if (!session) {
            informUser(slackId, `There is no running session!`, body.channel_id);
            return;
        }

        const updatedSession = await Session.pause(session);

        const toggleMessage = updatedSession.paused ?
            `Session paused! Run \`${Commands.PAUSE}\` again or \`${Commands.START}\` to resume. You still have ${updatedSession.time - updatedSession.elapsed} minutes left.` :
            `Resumed! You have ${updatedSession.time - updatedSession.elapsed} minutes left. Run \`${Commands.PAUSE}\` again to pause.`;

        informUser(slackId, toggleMessage, body.channel_id);
    } catch (error) {
        emitter.emit('error', error);
    }
});

// Can only start
Slack.command(Commands.START, async ({ ack, body }) => {
    try {
        const slackId = body.user_id;

        const session = await prisma.session.findFirst({
            where: {
                user: {
                    slackUser: {
                        slackId
                    }
                },
                completed: false,
                cancelled: false,
            }
        });

        if (!session) {
            informUser(slackId, "There is no running session!", body.channel_id);
            return;
        }

        if (!session.paused) {
            informUser(slackId, `Session is already running! Run \`${Commands.PAUSE}\` to pause.`, body.channel_id);
        }

        const updatedSession = await Session.pause(session);

        // Send a message to the user in the channel they ran the command
        informUser(slackId, `Session resumed! You have ${updatedSession.time - updatedSession.elapsed} minutes left. Run \`${Commands.PAUSE}\` to pause.`, body.channel_id);
    } catch (error) {
        emitter.emit('error', error);
    }
});