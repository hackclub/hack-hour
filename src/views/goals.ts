import { prisma } from "../app.js";
import { View } from "@slack/bolt";
import { formatHour } from "../utils/string.js";

export const Callbacks = {
    GOALS: 'goals-callback',
    CREATE: 'createGoal-callback',
    DELETE: 'deleteGoal-callback',
    ERROR: 'goals-error'
}
                
export const Actions = {
    SELECT: 'selectGoal',
    CREATE: 'createGoal',
    DELETE: 'deleteGoal'
}

export class Views {
    public static async goals(userId: string): Promise<View> {
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

        const selectedGoal = await prisma.goals.findFirst({
            where: {
                goalId: userData.selectedGoal
            }
        });

        if (goals.length === 0) {
            throw new Error(`Goals of ${userId} not found.`);
        }

        return {
            "callback_id": Callbacks.GOALS,       
            "type": "modal",
            "submit": {
                "type": "plain_text",
                "text": "Select",
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
                    "type": "rich_text",
                    "elements": [
                        {
                            "type": "rich_text_section",
                            "elements": [
                                {
                                    "type": "text",
                                    "text": "What are "
                                },
                                {
                                    "type": "text",
                                    "text": "Goals",
                                    "style": {
                                        "bold": true
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": "? Goals are what you want to achieve in the long term - for example, if you are coding a specific aspect of your project, then your current "
                                },
                                {
                                    "type": "text",
                                    "text": "session",
                                    "style": {
                                        "italic": true
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": " is that specific task, whereas your "
                                },
                                {
                                    "type": "text",
                                    "text": "goal",
                                    "style": {
                                        "italic": true
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": " is the project as a whole."
                                }
                            ]
                        }
                    ]
                },                
                {
                    "type": "actions",                    
                    "elements": [
                        {
                            "type": "radio_buttons",
                            "initial_option": {
                                "text": {
                                    "type": "plain_text",
                                    "text": `${selectedGoal?.goalName}`,
                                    "emoji": true
                                },
                                "value": `${selectedGoal?.goalId}`
                            },
                            "options": goals.map(goal => {
                                return {
                                    "text": {
                                        "type": "plain_text",
                                        "text": `${goal.goalName}`,
                                        "emoji": true,
                                    },
                                    "value": goal.goalId
                                }
                            }),
                            "action_id": Actions.SELECT
                        }
                    ],
                    "block_id": "goals"
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
                            "value": Actions.CREATE,
                            "action_id": Actions.CREATE
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Delete Goal",
                                "emoji": true
                            },
                            "value": Actions.DELETE,
                            "action_id": Actions.DELETE
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
                        "text": `You've spent *${formatHour(selectedGoal?.minutes)}* hours working on _${selectedGoal?.goalName}_.`
                    }
                }
            ]
        }
    }

    public static createGoal(metadata: string): View {
        return {
            "private_metadata": metadata,
            "type": "modal",
            "callback_id": Callbacks.CREATE,
            "submit": {
                "type": "plain_text",
                "text": "Submit",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Cancel",
                "emoji": true
            },
            "title": {
                "type": "plain_text",
                "text": "Goals",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "input",
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "goalName"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Enter Goal Name:",
                        "emoji": true				
                    },
                    "block_id": "goal"
                }
            ]
        }
    }

    public static deleteGoal(metadata: string): View {
        return {
            "private_metadata": metadata,
            "type": "modal",
            "callback_id": Callbacks.DELETE,
            "submit": {
                "type": "plain_text",
                "text": "Yes",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "No",
                "emoji": true
            },
            "title": {
                "type": "plain_text",
                "text": "Goals",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "rich_text",
                    "elements": [
                        {
                            "type": "rich_text_section",
                            "elements": [
                                {
                                    "type": "text",
                                    "text": "Are you sure you want delete this goal?"
                                }
                            ]
                        }
                    ]
                }
            ]
        };
    }

    public static error(error: string): View {
        return {
            "type": "modal",
            "callback_id": Callbacks.ERROR,
            "submit": {
                "type": "plain_text",
                "text": "Okay",
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
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": error
                    }
                }
            ]
        }
    }
}