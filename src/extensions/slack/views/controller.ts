import { Session } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js"
import { t, formatHour } from "../../../lib/templates.js";
import { Constants, Actions, Environment } from "../../../lib/constants.js";
import { app } from "../../../lib/bolt.js";

export class Controller {
    public static async panel(session: Session) {
        /*
        // Pre-fetch the goal
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
        */
        // hacky replacement, but fetch the goal from the session
        if (!session.goalId) { throw new Error(`No goal found for session ${session.messageTs}`); }

        const curGoal = await prisma.goal.findUniqueOrThrow({
            where: {
                id: session.goalId
            }
        });

        // Pre-fetch the slack user
        const slackUser = await prisma.slackUser.findUniqueOrThrow({
            where: {
                userId: session.userId
            }
        });

        // Context Info
        const context = {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": `*Goal:* ${curGoal.name} - ${formatHour(curGoal.totalMinutes)} hours`
                }
            ]
        };

        // Assemble the message
        // Info section
        const info = {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ""
            }
        };

        if (session.paused) {
            info.text.text = `You have paused your session. You have \`${session.time - session.elapsed}\` minutes remaining. \`${Constants.AUTO_CANCEL - session.elapsedSincePause}\` minutes untill the session is ended early.`
        } else if (session.cancelled) {
            info.text.text = `You have ended your session early.`
        } else if (session.completed) {
            info.text.text = t(`complete`, { slackId: slackUser.slackId })
        } else {
            info.text.text = `You have \`${session.time - session.elapsed}\` minutes remaining! ${t('encouragement', {})}`
        }

        // Pause Button
        const pause = {
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": "",
                "emoji": true
            },
            "value": session.messageTs,
            "action_id": ""
        };

        if (session.paused) {
            pause.text.text = "Resume";
            pause.action_id = Actions.RESUME;
        } else {
            pause.text.text = "Pause";
            pause.action_id = Actions.PAUSE;
        }

        const openGoal = {
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": "Change Goal",
                "emoji": true
            },
            "value": session.messageTs,
            "action_id": Actions.OPEN_GOAL
        };

        if (session.bankId || curGoal.completed) {
            return [
                info,
                {
                    "type": "divider"
                },
                context
            ]
        } else if (session.paused) {
            return [
                info,
                {
                    "type": "divider"
                },
                {
                    "type": "actions",
                    "elements": [
                        pause,
                    ],
                    "block_id": "panel"
                },
                context
            ]
        } else if (session.cancelled || session.completed) {
            return [
                info,
                {
                    "type": "divider"
                },
                {
                    "type": "actions",
                    "elements": [
                        openGoal
                    ],
                    "block_id": "panel"
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
                            "text": "End Early",
                            "emoji": true
                        },
                        "action_id": Actions.CANCEL
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Change Goal",
                            "emoji": true
                        },
                        "action_id": Actions.OPEN_GOAL
                    }
                ],
                "block_id": "panel"
            },
            context
        ]
    }

    public static async quick(session: Session) {
        // Pre-fetch the slack user
        const slackUser = await prisma.slackUser.findUnique({
            where: {
                userId: session.userId
            }
        });

        if (!slackUser) {
            throw new Error(`Could not find slack user for user ${session.userId}`);
        }

        const info = {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ""
            }
        };

        if (session.paused) {
            info.text.text = `You have paused your session. You have \`${session.time - session.elapsed}\` minutes remaining. \`${Constants.AUTO_CANCEL - session.elapsedSincePause}\` minutes untill the session is ended early.`
        } else if (session.cancelled) {
            info.text.text = `You have ended your session early.`
        } else if (session.completed) {
            info.text.text = t(`complete`, { slackId: slackUser.slackId })
        } else {
            info.text.text = `You have \`${session.time - session.elapsed}\` minutes remaining! ${t('encouragement', {})}`
        }

        const permalink = await app.client.chat.getPermalink({
            channel: Environment.MAIN_CHANNEL,
            message_ts: session.controlTs
        });

        if (!permalink) {
            throw new Error(`Could not get permalink for message ${session.controlTs}`);
        }

        const reach = {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `\`/cancel\` | \`/pause\` | \`/resume\` | \`/extend\` | \`/goal\` | <${permalink.permalink}|View Session>`
            }
        };

        return [
            info,
            {
                "type": "divider"
            },
            reach
        ];
    }

    /*
    public static extendHourModal(): View {
        return {
            "type": "modal",
            "callback_id": Callbacks.EXTEND_HOUR,
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
    }*/
}