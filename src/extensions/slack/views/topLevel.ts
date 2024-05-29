import { Session } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js"
import { formatHour, t, t_format } from "../lib/templates.js";

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

        let curGoal = await prisma.goal.findFirst({
            where: {
                userId: session.userId,
                selected: true
            }
        });

        if (!curGoal) {
            // Set the first goal as the selected goal
            const goals = await prisma.goal.findMany({
                where: {
                    userId: session.userId
                }
            });
            curGoal = goals[0];

            if (goals.length == 0) {
                throw new Error(`No goals found for user ${session.userId}`);
            }

            await prisma.goal.update({
                where: {
                    id: curGoal.id
                },
                data: {
                    selected: true
                }
            });
        }

        blocks.push({
            type: "context",
            elements: [
                {
                    "type": "mrkdwn",
                    "text": `*Goal:* ${curGoal.name} - ${formatHour(curGoal.totalMinutes)} hours`
                }
            ]
        });

        return blocks;
    }
}