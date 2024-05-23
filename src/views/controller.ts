import { Session } from "@prisma/client";
import { prisma } from "../lib/prisma.js"
import { t, formatHour } from "../lib/templates.js";
  
export class Controller {
    public static async panel(data: Session) {
        const curGoal = await prisma.goal.findFirst({
            where: {
                userId: data.userId,
                selected: true
            }
        });

        if (!curGoal) {
            throw new Error(`Could not find goal for user ${data.userId}`);
        }

        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `You have \`${data.time - data.elapsed}\` minutes remaining! ${t('encouragement', {})}`
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Pause",
                            "emoji": true
                        },
                        "value": data.userId,
                        "action_id": "pause"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Extend",
                            "emoji": true
                        },
                        "value": data.userId,
                        "action_id": "extend"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Cancel",
                            "emoji": true
                        },
                        "value": data.userId,
                        "action_id": "cancel"
                    }
                ]
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": `*Goal:* ${curGoal.name}`
                    }
                ]
            }
        ]
    }
}