/*
Cancellation
*/
import { app } from "../../../lib/bolt.js";
import { Environment, Actions, Commands, Callbacks } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";

import { fetchSlackId, informUser } from "../lib/lib.js";
import { Cancel } from "../views/cancel.js";

import { Session } from "../../../lib/corelib.js";
import { Slack } from "../../../lib/bolt.js";
import { pfps, t } from "../../../lib/templates.js";
import { handleError } from "../../../lib/handleError.js";

Slack.action(Actions.CANCEL, async ({ ack, body }) => {
    try {
        await ack();

        const thread_ts = (body as any).message.thread_ts;

        await Slack.views.open({
            trigger_id: (body as any).trigger_id,
            view: await Cancel.cancel(thread_ts)
        });
    } catch (error) {
        handleError(error);
    }
});

Slack.view(Callbacks.CANCEL, async ({ ack, body, view }) => {
    try {
        await ack();

        const slackId = body.user.id;
        const messageTs = view.private_metadata;

        const session = await prisma.session.findFirst({
            where: {
                messageTs,
                completed: false,
                cancelled: false,
            },
            select: {
                user: {
                    select: {
                        slackUser: {
                            select: {
                                slackId: true
                            }
                        }
                    }
                },
            }
        });

        console.log(session);
        console.log(slackId);
        console.log(session?.user.slackUser?.slackId);

        if (!session || slackId !== session.user.slackUser?.slackId) {
            informUser(slackId, t('error.not_yours', {}), Environment.MAIN_CHANNEL, messageTs, pfps['threat']);

            return;
        }

        await Session.cancel(await prisma.session.findFirstOrThrow({
            where: {
                messageTs,
                completed: false,
                cancelled: false,
            }
        }));
    } catch (error) {
        handleError(error)
    }
});
                
Slack.command(Commands.CANCEL, async ({ ack, body }) => {
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
            // Send a message to the user in the channel they ran the command
            informUser(slackId, t('error.not_hacking', {}), body.channel_id, undefined, pfps['question']);

            return;
        }

        if (session.metadata.firstTime) {
            informUser(slackId, t('error.first_time', {}), body.channel_id, undefined, pfps['question']);
        }

        await Session.cancel(session);
    } catch (error) {
        handleError(error)
    }
});