import { View, Block } from "@slack/bolt";
import { Actions, Callbacks } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js"
import { formatHour } from "../../../lib/templates.js";

export class Goals {
    public static async main(sessionTs: string): Promise<View> {
        const modal: View = {
            "type": "modal",
            "submit": {
                "type": "plain_text",
                "text": "Select",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Cancel",
                "emoji": true
            },
            "title": {
                "type": "plain_text",
                "text": "Goal Selection",
                "emoji": true
            },
            blocks: [] as Block[],
            callback_id: Callbacks.MAIN_GOAL,
            "private_metadata": sessionTs
        }

        const blocks = [
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
            }
        ]

        const session = await prisma.session.findUnique({
            where: {
                messageTs: sessionTs
            },
            include: {
                user: {
                    include: {
                        goals: {
                            where: {
                                completed: false
                            },
                            orderBy: {
                                createdAt: "asc"
                            }                     
                        }
                    }
                },
                goal: true
            }
        });

        if (!session) {
            throw new Error(`Session not found`);
        }

        const goals = session.user.goals;

        const selectedGoal = session.goal;

        blocks.push({
            "type": "actions",
            "elements": [
                {
                    "type": "radio_buttons",
                    "initial_option": selectedGoal ? {
                        "text": {
                            "type": "plain_text",
                            "text": selectedGoal.name,
                            "emoji": true
                        },
                        "value": selectedGoal.id
                    } : undefined,
                    "options": goals.map(goal => {
                        return {
                            "text": {
                                "type": "plain_text",
                                "text": goal.name,
                                "emoji": true
                            },
                            "value": goal.id
                        }
                    }),
                    "action_id": Actions.SELECT_GOAL
                }
            ]
        } as any);

        blocks.push({
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Create Goal",
						"emoji": true
					},
					"value": Actions.CREATE_GOAL,
					"action_id": Actions.CREATE_GOAL
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Delete Goal",
						"emoji": true
					},
					"value": selectedGoal ? selectedGoal.id : 'NONE',
					"action_id": Actions.DELETE_GOAL
				}
			],
            "block_id": "goal_actions"
		} as any);

        if (selectedGoal) {
            blocks.push({
                "type": "divider"
            } as any);

            blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `You've spent *${formatHour(selectedGoal.totalMinutes)}* hours working on _${selectedGoal.name}_.`
                }
            } as any);
        }

        modal.blocks = blocks;

        return modal;
    }

    public static async create(sessionTs: string): Promise<View> {
        return {
            "type": "modal",
            "callback_id": Callbacks.CREATE_GOAL,
            "title": {
                "type": "plain_text",
                "text": "Create Goal",
                "emoji": true
            },
            "submit": {
                "type": "plain_text",
                "text": "Create",
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
                        "type": "plain_text_input",
                        "action_id": "name",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Goal Name"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Name"
                    },
                    "block_id": "goal_name"
                }
            ],
            "private_metadata": sessionTs
        }
    }

    public static async delete(sessionTs: string): Promise<View> {
        // Are you sure you want to delete this goal?
        const session = await prisma.session.findUniqueOrThrow({
            where: {
                messageTs: sessionTs
            },
            include: {
                goal: true
            }
        });

        return {
            "type": "modal",
            "callback_id": Callbacks.DELETE_GOAL,
            "title": {
                "type": "plain_text",
                "text": "Delete Goal",
                "emoji": true
            },
            "submit": {
                "type": "plain_text",
                "text": "Delete",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Cancel",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Are you sure you want to delete goal ${session.goal?.name}?`
                    }
                }
            ],
            "private_metadata": sessionTs
        }
    }
} 