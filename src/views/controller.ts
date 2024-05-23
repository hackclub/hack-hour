import { Session } from "@prisma/client";
import { prisma } from "../lib/prisma.js"
import { t, formatHour } from "../lib/templates.js";
import { Actions, Callbacks } from "../lib/constants.js";
import { View } from "@slack/bolt";

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

        if (data.completed) {
            const slackUser = await prisma.slackUser.findUnique({
                where: {
                    userId: data.userId
                }
            });

            if (!slackUser) {
                throw new Error(`Could not find slack user for user ${data.userId}`);
            }

            return [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": t('complete', {
                            slackId: slackUser.slackId,
                        })
                    }
                },
                {
                    "type": "divider"
                },
                context
            ]
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

    public static extendHourModal(): View {
        return {
            "type": "modal",
            "callback_id": Callbacks.EXTENDHOUR,
            "title": {
                "type": "plain_text",
                "text": "Extend Hour",
                "emoji": true
            },
            "submit": {
                "type": "plain_text",
                "text": "Extend",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Cancel",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "input",
                    "element": {
                        "type": "number_input",
                        "is_decimal_allowed": false,
                        "action_id": "extendTime",
                        "min_value": "1",
                        "initial_value": "10"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "# of minutes to extend hour by:",
                        "emoji": true,
                    }
                }
            ]
        }
    }
}