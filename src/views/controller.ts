import { Session } from "@prisma/client";
import { prisma } from "../lib/prisma.js"
import { t, formatHour } from "../lib/templates.js";
import { Actions } from "../lib/constants.js";

export class Controller {
    public static async panel(data: Session) {
        // Pre-fetch the goal
        const curGoal = await prisma.goal.findFirst({
            where: {
                userId: data.userId,
                selected: true
            }
        });

        if (!curGoal) {
            throw new Error(`Could not find goal for user ${data.userId}`);
        }

        // Assemble the message
        // Info section
        const info = {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ""
            }
        };

        if (data.paused) {
            info.text.text = `You have paused your session. You have \`${data.time - data.elapsed}\` minutes remaining. \`${data.elapsedSincePause || 0}\` minutes since paused.`
        } else if (data.cancelled) {
            info.text.text = `You have cancelled your session.`
        } else {
            info.text.text = `You have \`${data.time - data.elapsed}\` minutes remaining! ${t('encouragement', {})}`
        }

        // Pause Button
        const pause = {
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": "",
                "emoji": true
            },
            "value": data.messageTs,
            "action_id": ""
        };

        if (data.paused) {
            pause.text.text = "Resume";
            pause.action_id = Actions.RESUME;
        } else {
            pause.text.text = "Pause";
            pause.action_id = Actions.PAUSE;
        }

        // Context Info
        const context = {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": `*Goal:* ${curGoal.name}`
                }
            ]
        };

        if (data.paused) {
            return [
                info,
                {
                    "type": "divider"
                },
                {
                    "type": "actions",
                    "elements": [
                        pause
                    ],                    
                    "block_id": "panel"                
                },
                context
            ]        
        } else if (data.cancelled) {
            return [
                info,
                {
                    "type": "divider"
                },
                context
            ]
        }

        return [
            info,
            {
                "type": "divider"
            },
            {
                "type": "actions",
                "elements": [
                    pause,
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Extend",
                            "emoji": true
                        },
                        "action_id": Actions.EXTEND
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Cancel",
                            "emoji": true
                        },
                        "action_id": Actions.CANCEL
                    }
                ],
                "block_id": "panel"                
            }
        ]
    }
}