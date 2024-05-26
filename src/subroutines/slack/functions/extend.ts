import { app } from "../../../lib/bolt.js";
import { Environment, Actions, Commands } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { emitter } from "../../../lib/emitter.js";

import { updateController, updateTopLevel, informUser } from "../lib.js";

/*
Time Extension
*/
app.action(Actions.EXTEND, async ({ ack, body }) => {
    await ack();
    // TODO
    informUser(body.user.id, `Use \`${Commands.EXTEND}\` to extend the amount of time you have!`, Environment.MAIN_CHANNEL, (body as any).message.thread_ts);
});

app.command(Commands.EXTEND, async ({ ack, body }) => {
    try {
        await ack();
        
        const slackId = body.user_id;
        
        const session = await prisma.session.findFirst({
            where: {
                user: {
                    slackUser: {
                        slackId: body.user_id
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

        const minutes = parseInt(body.text);

        if (isNaN(minutes) || minutes <= 0) {
            informUser(slackId, `Invalid time!`, body.channel_id);

            return;
        }

        const updatedSession = await prisma.session.update({
            where: {
                messageTs: session.messageTs
            },
            data: {
                time: {
                    increment: minutes
                }
            }
        });

        informUser(slackId, `Session extended by ${minutes} minutes! Remaining time: ${updatedSession.time-updatedSession.elapsed} out of ${updatedSession.time} minutes`, body.channel_id);

        // Update the session ts
        await updateController(updatedSession);
        await updateTopLevel(updatedSession);
    } catch (error) {
        emitter.emit('error', error);
    }
});