import { prisma } from "../app.js";
import { KnownBlock, View } from "@slack/bolt";
import { formatHour } from "../utils/string.js";

export const Callbacks = {
    STATS: 'stats'
}

export class Views {
    public static async stats(userId: string): Promise<View> {
        const userData = await prisma.user.findUnique({
            where: {
                slackId: userId
            }
        });

        if (!userData) {
            throw new Error(`User ${userId} not found.`);
        }

        const goals = await prisma.goals.findMany({
            where: {
                slackId: userId
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
                    "text": `*${goal.goalName}*: ${formatHour(goal.minutes)} hours spent\n_(${goal.minutes} minutes)_`
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
                "text": `*Lifetime Hours Spent*: ${formatHour(userData?.totalMinutes)}\n_(${userData?.totalMinutes} minutes)_`
            }
        });

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