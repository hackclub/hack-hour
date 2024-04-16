import { prisma } from "../app.js";
import { View } from "@slack/bolt";

export const Callbacks = {
    GOALS: 'goals-callback',
}

export class Views {
    public static async goals(userId: string): Promise<View> {
        const goals = await prisma.goal.findMany({
            where: {
                userId
            }
        });

        if (goals.length === 0) {
            throw new Error("No goals found.");
        }

        return {
            "callback_id": Callbacks.GOALS,       
            "type": "modal",
            "submit": {
                "type": "plain_text",
                "text": "I'm done",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Close",
                "emoji": true
            },
            "title": {
                "type": "plain_text",
                "text": "Goals",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "Select your goals:",
                        "emoji": true
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "radio_buttons",
                            "options": goals.map(goal => {
                                return {
                                    "text": {
                                        "type": "plain_text",
                                        "text": "*plain_text option 0*",
                                        "emoji": true
                                    },
                                    "value": goal.goalId
                                }
                            }),
                            "action_id": "selectGoal"
                        }
                    ]
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Create Goal",
                                "emoji": true
                            },
                            "value": "create"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Delete Goal",
                                "emoji": true
                            },
                            "value": "delete"
                        }
                    ]
                },
                {
                    "type": "divider"
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "You've spent *{hours}* hours working on _{goal}_."
                    }
                }
            ]
        }
    }
}