/*
Pause Management
*/
import { app } from "../../../lib/bolt.js";
import { Environment, Actions, Commands } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { emitter } from "../../../lib/emitter.js";

import { Session, updateController, updateTopLevel, fetchSlackId, informUser } from "../lib/lib.js";

// TODO: Move to a standard library
async function pauseUpdate(session: Session) {
    // If resuming the session, reset the elapsed time since pause
    const updatedSession = await prisma.session.update({
        where: {
            messageTs: session.messageTs
        },
        data: {
            paused: !session.paused,
            elapsedSincePause: session.paused ? 0 : session.elapsedSincePause
        }
    });

    if (updatedSession.paused) {
        emitter.emit('pause', updatedSession);
    } else {
        emitter.emit('resume', updatedSession);
    }

    return updatedSession;
}

app.action(Actions.PAUSE, async ({ ack, body }) => {
    try {
        const slackId = body.user.id;

        await ack();

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
            await app.client.chat.postEphemeral({
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
            await app.client.chat.postEphemeral({
                user: slackId,
                channel: Environment.MAIN_CHANNEL,
                text: `You cannot pause another user's session!`,
                thread_ts: (body as any).message.thread_ts
            });                

            return;
        }

        await pauseUpdate(session);
    } catch (error) {
        emitter.emit('error', error);
    }
});

app.action(Actions.RESUME, async ({ ack, body }) => {
    try {
        const slackId = body.user.id;

        await ack();

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
            await app.client.chat.postEphemeral({
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
            await app.client.chat.postEphemeral({
                user: slackId,
                channel: Environment.MAIN_CHANNEL,
                text: `You cannot resume another user's session!`,
                thread_ts: (body as any).message.thread_ts
            });                

            return;
        }

        await pauseUpdate(session);
    } catch (error) {
        emitter.emit('error', error);
    }
});

// Can toggle
app.command(Commands.PAUSE, async ({ ack, body }) => {
    try {
        await ack();

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

        const updatedSession = await pauseUpdate(session);

        const toggleMessage = updatedSession.paused ?
            `Session paused! Run \`${Commands.PAUSE}\` again or \`${Commands.START}\` to resume. You still have ${updatedSession.time - updatedSession.elapsed} minutes left.` :
            `Resumed! You have ${updatedSession.time - updatedSession.elapsed} minutes left. Run \`${Commands.PAUSE}\` again to pause.`;

        informUser(slackId, toggleMessage, body.channel_id);
    } catch (error) {
        emitter.emit('error', error);
    }
});

// Can only start
app.command(Commands.START, async ({ ack, body }) => {
    try {
        await ack();

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

        const updatedSession = await pauseUpdate(session);

        // Send a message to the user in the channel they ran the command
        informUser(slackId, `Session resumed! You have ${updatedSession.time - updatedSession.elapsed} minutes left. Run \`${Commands.PAUSE}\` to pause.`, body.channel_id);
    } catch (error) {
        emitter.emit('error', error);
    }
});