import { Slack } from "../../../lib/bolt.js";
import { Environment, Actions, Commands } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { emitter } from "../../../lib/emitter.js";

import { updateController, updateTopLevel, informUser } from "../lib/lib.js";
import { Session } from "../../../lib/corelib.js";
/*
Time Extension
*/
Slack.action(Actions.EXTEND, async ({ body }) => {
    // TODO
    //    informUser(body.user.id, `Use \`${Commands.EXTEND}\` to extend the amount of time you have!`, Environment.MAIN_CHANNEL, (body as any).message.thread_ts);
    informUser(body.user.id, `This command is disabled for now!`, Environment.MAIN_CHANNEL, (body as any).message.thread_ts);
});

Slack.command(Commands.EXTEND, async ({ body }) => {
    try {
        // TODO: Stop current session & create a new session with exact same details + 60 minutes

        // Disable extend for now
        informUser(body.user_id, `This command is disabled for now!`, body.channel_id);
        return;

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

        let minutes = parseInt(body.text || '60');
        // let minutes = 60;

        if (isNaN(minutes) || minutes <= 0) {
            informUser(slackId, `Invalid time!`, body.channel_id);

            return;
        }

        if (minutes > 60) {
            informUser(slackId, `You can extend by 60 minutes maximum at a time!`, body.channel_id);
            minutes = 60;
        }

        /*
                const updatedSession = await Session.extend(session, minutes);
        
                informUser(slackId, `Session extended by ${minutes} minutes! Remaining time: ${updatedSession.time-updatedgetElapsed(session)} out of ${updatedSession.time} minutes`, body.channel_id);
        
                // Update the session ts
                await updateController(updatedSession);
                await updateTopLevel(updatedSession);*/
    } catch (error) {
        emitter.emit('error', { error });
    }
});
