import { prisma } from "../../../lib/prisma.js";
import { KnownBlock, View } from "@slack/bolt";
import { formatHour } from "../../../lib/templates.js";

import { Callbacks } from "../../../lib/constants.js";

export class Stats {
    public static async stats(userId: string): Promise<View> {
        const userData = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });

        if (!userData) {
            throw new Error(`User ${userId} not found.`);
        }

        const goals = await prisma.goal.findMany({
            where: {
                userId: userId
            }
        });

        if (goals.length === 0) {
            throw new Error(`Goals of ${userId} not found.`);
        }
        
        const blocks: KnownBlock[] = goals.map(goal => {
            return {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `*${goal.name}*: ${formatHour(goal.totalMinutes)} hours spent\n_(${goal.totalMinutes} minutes${goal.completed ? " - Completed)" : ")"}_`
                }
            }
        });

        blocks.unshift({
            "type": "divider"
        });
        blocks.unshift({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `*Lifetime Hours Spent*: ${formatHour(userData?.lifetimeMinutes)}\n_(${userData?.lifetimeMinutes} minutes)_`
            }
        });

        /*
        // Check if user is in eventContributions
        const eventContributions = await prisma.eventContributions.findMany({
            where: {
                slackId: userId,
                eventId: "powerhour"
            }
        });

        if (eventContributions) {
            blocks.push({
                "type": "divider"
            });
            blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `*Power Hour Contributions*: ${formatHour(eventContributions[0].minutes)} hours\n_(${eventContributions[0].minutes} minutes)_`
                }
            });
        }       
        */ 

        return {
            "type": "modal",
            "callback_id": Callbacks.STATS,
            "title": {
                "type": "plain_text",
                "text": "My Stats",
                "emoji": true
            },
            "submit": {
                "type": "plain_text",
                "text": "Done",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Close",
                "emoji": true
            },
            "blocks": blocks
        }
    }
}