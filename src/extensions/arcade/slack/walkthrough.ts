import getUrls from "get-urls";
import { app, Slack } from "../../../lib/bolt.js";
import { Actions, Environment } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { updateController } from "../../slack/lib/lib.js";
import { fetchEvidence } from "../lib/helper.js";
import { t } from "../../../lib/templates.js";

Slack.action(Actions.TUTORIAL_ADVANCE, async ({ ack, body, client }) => {
    await ack();

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
            text: 'Only the user who started the tutorial can advance it',
            thread_ts: session.messageTs,
            user: (body as any).user.id
        });

        return;
    }

    if (session.metadata.firstTime) {
        if (session.metadata.firstTime.step === 1) {
            const { evidenced, activity } = await fetchEvidence(session.messageTs, session.user.slackUser.slackId);
            
            if (!evidenced) {
                await Slack.chat.postEphemeral({
                    channel: Environment.MAIN_CHANNEL,
                    text: t('firstTime.walkthrough.no_evidence', {}),
                    thread_ts: session.messageTs,
                    user: (body as any).user.id
                });

                return;
            }
        }

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

Slack.action(Actions.TUTORIAL_BACK, async ({ ack, body, client }) => {
    await ack();

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
            text: 'Only the user who started the tutorial can advance it',
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