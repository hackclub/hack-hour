/*
Pause Management
*/
import { Slack } from "../../../lib/bolt.js";
import { Environment, Actions, Commands } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { emitter } from "../../../lib/emitter.js";
import { Session } from "../../../lib/corelib.js";

import { fetchSlackId, informUser } from "../lib/lib.js";
import { pfps, t } from "../../../lib/templates.js";

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
            informUser(slackId, t('error.not_yours', {}), Environment.MAIN_CHANNEL, (body as any).message.thread_ts, pfps['threat']);

            return;
        }

        const slackOwnerId = await fetchSlackId(session.userId);

        if (slackId !== slackOwnerId) {
            // Send an ephemeral message to the actor
            await Slack.chat.postEphemeral({
                user: slackId,
                channel: Environment.MAIN_CHANNEL,
                text: t(`error.not_yours`, {}),
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
            informUser(slackId, t('error.not_yours', {}), Environment.MAIN_CHANNEL, (body as any).message.thread_ts, pfps['threat']);          

            return;
        }

        const slackOwnerId = await fetchSlackId(session.userId);

        if (slackId !== slackOwnerId) {
            informUser(slackId, t('error.not_yours', {}), Environment.MAIN_CHANNEL, (body as any).message.thread_ts, pfps['threat']);

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
            informUser(slackId, t('error.not_hacking', {}), body.channel_id);
            return;
        }

        if (session.metadata.firstTime) {
            informUser(slackId, t('error.first_time', {}), body.channel_id, undefined, pfps['question']);
        }

        const updatedSession = await Session.pause(session);

        const toggleMessage = updatedSession.paused ?
        t('action.paused', {
            minutes: updatedSession.time - updatedSession.elapsed
        }) :
        t('action.resumed', {
            minutes: updatedSession.time - updatedSession.elapsed
        });

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
            informUser(slackId, t('error.not_hacking', {}), body.channel_id, undefined, pfps['question']);
            return;
        }

        if (session.metadata.firstTime) {
            informUser(slackId, t('error.first_time', {}), body.channel_id, undefined, pfps['question']);
        }

        if (!session.paused) {
            informUser(slackId, t('error.already_resumed', {}), body.channel_id, undefined, pfps['question']);
        }

        const updatedSession = await Session.pause(session);

        // Send a message to the user in the channel they ran the command
        informUser(slackId, t('action.resumed', {
            minutes: updatedSession.time - updatedSession.elapsed
        }), body.channel_id);
    } catch (error) {
        emitter.emit('error', error);
    }
});