import { Session } from "@prisma/client";
import { prisma } from "../lib/prisma.js"
import { t, formatHour, t_format } from "../lib/templates.js";
import { Actions, Callbacks } from "../lib/constants.js";
import { View } from "@slack/bolt";

export class TopLevel {
    public static async topLevel(session: Session) {
        const blocks = [];

        // Prefetch data

        const slackUser = await prisma.slackUser.findUnique({
            where: {
                userId: session.userId
            }
        });

        if (!session.metadata) {
            throw new Error('Session metadata is missing');
        }

        const metadata: any = session.metadata;

        // Generate blocks

        const topLevelMessage = {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: ""
            }
        };

        if (session.paused) {
            topLevelMessage.text.text = t('pause', { slackId: slackUser?.slackId })
        } else if (session.cancelled) {
            topLevelMessage.text.text = t('cancel', { slackId: slackUser?.slackId })
        } else if (session.completed) {
            topLevelMessage.text.text = t('complete', { slackId: slackUser?.slackId })
        } else {
            topLevelMessage.text.text = t_format(metadata.toplevel_template, { slackId: slackUser?.slackId, minutes: session.time - session.elapsed });
        }

        blocks.push(topLevelMessage);

        blocks.push({
            type: 'divider'
        });

        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: metadata.work
            }
        });
        
        blocks.push({
            type: 'divider'
        });

        const curGoal = await prisma.goal.findFirst({
            where: {
                userId: session.userId,
                selected: true
            }
        });

        if (!curGoal) {
            throw new Error(`Could not find goal for user ${session.userId}`);
        }

        blocks.push({
            type: "context",
            elements: [
                {
                    "type": "mrkdwn",
                    "text": `*Goal:* ${curGoal.name}`
                }
            ]
        });

        return blocks;
    }
}