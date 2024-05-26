/*
Cancellation
*/
import { app } from "../../../lib/bolt.js";
import { Environment, Actions, Commands } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { emitter } from "../../../lib/emitter.js";

import { fetchSlackId, informUser, cancelSession, updateTopLevel } from "../lib/lib.js";

app.action(Actions.CANCEL, async ({ ack, body }) => {
    try {
        await ack();

        const slackId = body.user.id;
        const messageTs = (body as any).message.thread_ts;

        const session = await prisma.session.findFirst({
            where: {
                messageTs,
                completed: false,
                cancelled: false,
            }
        });

        if (!session) {
            throw new Error(`Session not found for ${slackId}`);
        }
        
        if (slackId !== await fetchSlackId(session.userId)) {
            // Send an ephemeral message to the actor
            await app.client.chat.postEphemeral({
                user: slackId,
                channel: Environment.MAIN_CHANNEL,
                text: `You cannot cancel another user's session!`,
                thread_ts: messageTs
            });                

            return;
        }

        await cancelSession(slackId, session);
    } catch (error) {
        emitter.emit('error', error);
    }
});
                
app.command(Commands.CANCEL, async ({ ack, body }) => {
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
            // Send a message to the user in the channel they ran the command
            informUser(slackId, `There is no running session!`, body.channel_id);

            return;
        }

        await cancelSession(slackId, session);
    } catch (error) {
        emitter.emit('error', error);
    }    
});