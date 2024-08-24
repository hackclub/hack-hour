import { app, Slack } from "../../../lib/bolt.js";
import { Actions, Environment } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { updateController } from "../../slack/lib/lib.js";
import { t } from "../../../lib/templates.js";

Slack.action(Actions.TUTORIAL_ADVANCE, async ({ body, client }) => {
    const session = await prisma.session.findFirstOrThrow({
        where: {
            messageTs: (body as any).message.thread_ts,
        },
        include: {
            user: {
                include: {
                    slackUser: true
                }
            }
        }
    });

    if (!session.user.slackUser) {
        throw new Error('No slack user found for session user');
    }

    // Make sure the user is the one who started the tutorial
    if (session.user.slackUser.slackId !== (body as any).user.id) {
        await Slack.chat.postEphemeral({
            channel: Environment.MAIN_CHANNEL,
            text: t('error.not_yours'),
            thread_ts: session.messageTs,
            user: (body as any).user.id
        });

        return;
    }

    if (session.metadata.firstTime) {
        if (session.metadata.firstTime.step === 0) {
            await Slack.chat.postMessage({
                channel: Environment.MAIN_CHANNEL,
                thread_ts: session.messageTs,
                user: (body as any).user,
                text: t('firstTime.tutorial_step_2'),
                // blocks: [
                //     {
                //         "type": "section",
                //         "text": {
                //             "type": "mrkdwn",
                //             "text": t('firstTime.tutorial_step_2')
                //         },
                //         "accessory": {
                //             "type": "button",
                //             "text": {
                //                 "type": "plain_text",
                //                 "text": "continue..."
                //             },
                //             "action_id": Actions.TUTORIAL_ADVANCE,
                //         }
                //     }
                // ]
            });
        }

        // if (session.metadata.firstTime.step === 1) {
        //     const { evidenced, activity } = await fetchEvidence(session.messageTs, session.user.slackUser.slackId);
            
        //     if (!evidenced) {
        //         await Slack.chat.postEphemeral({
        //             channel: Environment.MAIN_CHANNEL,
        //             text: t('firstTime.walkthrough.no_evidence'),
        //             thread_ts: session.messageTs,
        //             user: (body as any).user.id
        //         });

        //         return;
        //     }
        // }

        session.metadata.firstTime.step++;
    }

    const updatedSession = await prisma.session.update({
        where: {
            id: session.id
        },
        data: {
            metadata: session.metadata
        }
    });

    await updateController(updatedSession);
});

Slack.action(Actions.TUTORIAL_BACK, async ({ body, client }) => {
    const session = await prisma.session.findFirstOrThrow({//findUnique({
        where: {
            messageTs: (body as any).message.thread_ts,
        },
        include: {
            user: {
                include: {
                    slackUser: true
                }
            }
        }
    });

    if (!session.user.slackUser) {
        throw new Error('No slack user found for session user');
    }

    // Make sure the user is the one who started the tutorial
    if (session.user.slackUser.slackId !== (body as any).user.id) {
        await Slack.chat.postEphemeral({
            channel: Environment.MAIN_CHANNEL,
            text: t('error.not_yours'),
            thread_ts: session.messageTs,
            user: (body as any).user.id
        });

        return;
    }

    if (session.metadata.firstTime) {
        session.metadata.firstTime.step--;
    }

    const updatedSession = await prisma.session.update({
        where: {
            id: session.id
        },
        data: {
            metadata: session.metadata
        }
    });

    await updateController(updatedSession);
});