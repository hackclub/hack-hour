/*
Cancellation
*/
import { app } from "../../../lib/bolt.js";
import { Environment, Actions, Commands, Callbacks } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { emitter } from "../../../lib/emitter.js";

import { fetchSlackId, informUser, updateTopLevel } from "../lib/lib.js";
import { Cancel } from "../views/cancel.js";

import { Session } from "../../../lib/corelib.js";

app.action(Actions.CANCEL, async ({ ack, body }) => {
    try {
        const thread_ts = (body as any).message.thread_ts;

        await ack();

        await app.client.views.open({
            trigger_id: (body as any).trigger_id,
            view: await Cancel.cancel(thread_ts)
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});

app.view(Callbacks.CANCEL, async ({ ack, body, view }) => {
    try {
        await ack();

        const slackId = body.user.id;
        const messageTs = view.private_metadata;

        const session = await prisma.session.findFirst({
            where: {
                messageTs,
                completed: false,
                cancelled: false,
            }
        });
 
        if (!session || slackId !== await fetchSlackId(session.userId)) {
            // Send an ephemeral message to the actor
            await app.client.chat.postEphemeral({
                user: slackId,
                channel: Environment.MAIN_CHANNEL,
                text: `You cannot end another user's session!`,
                thread_ts: messageTs
            });                

            return;
        }

        await Session.cancel(session);
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

        await Session.cancel(session);
    } catch (error) {
        emitter.emit('error', error);
    }
});