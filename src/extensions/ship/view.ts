import { KnownBlock, ModalView } from "@slack/bolt";
import { prisma } from "../../lib/prisma.js";
import { app } from "../../lib/bolt.js";
import { Environment } from "../../lib/constants.js";
import { formatHour } from "../../lib/templates.js";

export const Actions = {
    OPEN_SESSION_REVIEW: 'open_session_review',
    UPDATE_SESSION_GOAL: 'update_session_goal',
    OPEN_GOAL_SELECT: 'open_goal_select',
    CONFIRM_GOAL_SELECT: 'confirm_goal_select',
    SUBMIT: 'submit'
}

export const Callbacks = {
    COMPLETE_GOAL: 'goal_complete'
}

export class Ship {
    public static async init(shipTs: string): Promise<KnownBlock[]> {
        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "Awesome job with that ship! Let's get your hours banked in! :yay:"
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
                            "text": "Let's Do It!",
                            "emoji": true
                        },
                        "value": shipTs,
                        "action_id": Actions.OPEN_SESSION_REVIEW
                    }
                ]
            }
        ]
    }

    public static async openSessionReview(slackId: string, shipTs: string): Promise<KnownBlock[]> {
        const date = new Date(parseInt(shipTs.split(".")[0]) * 1000);

        const sessions = await prisma.session.findMany({
            where: {
                user: {
                    slackUser: {
                        slackId
                    }
                },
                goal: {
                    completed: false
                },
                bankId: null,
                createdAt: {
                    lte: date
                }
            },
            orderBy: [
                {
                    createdAt: "asc"
                },
                {
                    goal: {
                        name: "asc"
                    }
                },
                {
                    metadata: {
                        sort: "asc"
                    }
                }
            ],
            include: {
                goal: true,
            }
        });

        if (sessions.length === 0) {
            return [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "No Sessions Found",
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "You have completed no sessions! You need to complete a session before you can ship it for hack hour."
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
                                "text": "Refresh",
                                "emoji": true
                            },
                            "action_id": Actions.OPEN_SESSION_REVIEW
                        }
                    ]
                }
            ]
        }        

        const goals = await prisma.goal.findMany({
            where: {
                user: {
                    slackUser: {
                        slackId
                    }
                },
                completed: false
            },
            orderBy: {
                createdAt: "asc"
            }
        });

        let blocks: KnownBlock[] = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "Review Sessions 📝",
                    "emoji": true
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "_Review your sessions and edit their respective goals._ You will be shipping a goal alongside your project - note that this is subject to manual review."
                }
            },
            {
                "type": "divider"
            }
        ];

        for (const session of sessions) {
            const permalink = await app.client.chat.getPermalink({
                channel: Environment.MAIN_CHANNEL,
                message_ts: session.messageTs
            });

            if (!session.goal) { throw new Error("Session has no goal"); }

            blocks.push(
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `*${session.createdAt.getMonth()}/${session.createdAt.getDate()}*\n${(session.metadata as any).work}\n`
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "static_select",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Select an goal",
                                "emoji": true
                            },
                            "initial_option": {
                                "text": {
                                    "type": "plain_text",
                                    "text": session.goal.name,
                                    "emoji": true
                                },
                                "value": JSON.stringify({ 
                                    goalId: session.goal.id,
                                    sessionTs: session.messageTs
                                })
                            },
                            "options": goals.map(goal => {
                                return {
                                    "text": {
                                        "type": "plain_text",
                                        "text": goal.name,
                                        "emoji": true
                                    },
                                    "value": JSON.stringify({ 
                                        goalId: goal.id,
                                        sessionTs: session.messageTs
                                    })
                                }
                            }),
                            "action_id": Actions.UPDATE_SESSION_GOAL,
                        }
                    ]                    
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": `_Hours:_ ${formatHour(session.elapsed)} | _Goal:_ ${session.goal?.name} | <${permalink.permalink}|View Session>`
                        }
                    ]
                }
            );
        }

        blocks.push(
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
                            "text": "Refresh",
                            "emoji": true
                        },
                        "action_id": Actions.OPEN_SESSION_REVIEW
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Bank Hours",
                            "emoji": true
                        },
                        "style": "primary",
                        "action_id": Actions.OPEN_GOAL_SELECT
                    }
                ]
            }
        );

        return blocks;
    }

    public static async openGoalSelect(slackId: string): Promise<KnownBlock[]> {
        const goals = await prisma.goal.findMany({
            where: {
                user: {
                    slackUser: {
                        slackId
                    }
                },
                completed: false,
                NOT: {
                    name: "No Goal"
                }
            },
            orderBy: {
                createdAt: "asc"
            },
            include: {
                sessions: true
            }
        });

        if (goals.length === 0) {
            return [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "No Goals to Ship",
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "You have no goals to ship! You need to create a goal first before you can ship it. Go to one of your sessions and choose `Change Goal` to create a new goal."
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
                                "text": "Back",
                                "emoji": true
                            },
                            "action_id": Actions.OPEN_SESSION_REVIEW
                        }
                    ]
                }
            ]
        }

        return [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "Ship a Goal 🚢 & Bank your Hours",
                    "emoji": true
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "Select the goal you’re making a ship or scrapbook post for– you’ll be banking all sessions attached to that goal for review.\nYou can bank your hours as many times as you want!"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "input",                
                "element": {
                    "type": "radio_buttons",
                    "options": goals.map(goal => {
                        return {
                            "text": {
                                "type": "plain_text",
                                "text": `${goal.name}\n_${goal.sessions.length} sessions_ | _Total Hours: ${formatHour(goal.sessions.reduce((acc, session) => acc + session.elapsed, 0))}_`,
                                "emoji": true
                            },
                            "value": goal.id
                        }
                    }),
                    "action_id": "select"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Label",
                    "emoji": true
                },
                "block_id": "goals"
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Back",
                            "emoji": true
                        },
                        "action_id": Actions.OPEN_SESSION_REVIEW
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Submit",
                            "emoji": true
                        },
                        "style": "primary",
                        "action_id": Actions.CONFIRM_GOAL_SELECT
                    }
                ]
            }
        ]
    }

    public static async confirm(goalId: string): Promise<KnownBlock[]> {
        return [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "Confirm Goal Shipping 🚢",
                    "emoji": true
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "Are you sure you want to ship this goal?"
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
                            "text": "Cancel",
                            "emoji": true
                        },
                        "action_id": Actions.OPEN_GOAL_SELECT
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Complete",
                            "emoji": true
                        },
                        "style": "danger",
                        "value": goalId,
                        "action_id": Actions.SUBMIT
                    }
                ]
            }
        ]
    }

    public static async complete(): Promise<KnownBlock[]> {
        return [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "Goal Shipped!",
                    "emoji": true
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "Your goal has been completed and your hours are currently under review."
                }
            }
        ]
    }

    public static async sessionReview(): Promise<ModalView> {
        const sessions = await prisma.session.findMany({
            include: {
                goal: true        
            }
        });

        let blocks: KnownBlock[] = [];

        for (let session of sessions) {
            if (!(session.metadata as any).airtable) {
                blocks.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `*${session.createdAt.getMonth()}/${session.createdAt.getDate()}*\n${(session.metadata as any).work}\n_Goal:_ ${session.goal?.name}\n*Not submitted*: Please send a message in <#C06U5U9ADGD>\n<${
                            (await app.client.chat.getPermalink({
                                channel: Environment.MAIN_CHANNEL,
                                message_ts: session.messageTs
                            })).permalink
                        }|View Session>`
                    }
                });
                blocks.push({
                    "type": "divider"
                });
            }
            if (!(session.metadata as any).airtable.status) {
                session = await prisma.session.update({
                    where: {
                        messageTs: session.messageTs
                    },
                    data: {
                        metadata: {
                            ...(session.metadata as any),
                            airtable: {
                                ...(session.metadata as any).airtable,
                                status: "Manual/Status Unavailable",
                                reason: null
                            }
                        }
                    },
                    include: {
                        goal: true
                    }
                });
            }
             
            blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `*${session.createdAt.getMonth()}/${session.createdAt.getDate()}*\n${(session.metadata as any).work}\n_Goal:_ ${session.goal?.name}\n*${(session.metadata as any).airtable.status}${
                        (session.metadata as any).airtable.reason ? `:* ${(session.metadata as any).airtable.reason}` : "*"
                    }\n<${
                        (await app.client.chat.getPermalink({
                            channel: Environment.MAIN_CHANNEL,
                            message_ts: session.messageTs
                        })).permalink
                    }|View Session>`
                }
            });
            blocks.push({
                "type": "divider"
            });
        }

        return {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "View Sessions",
                "emoji": true
            },
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
            "blocks": blocks
        }
    }
}