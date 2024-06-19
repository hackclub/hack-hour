import { KnownBlock, View } from "@slack/bolt";
import { Actions, Callbacks, Environment } from "../../../lib/constants.js";
import type { Session } from "@prisma/client";
import { t } from "../../../lib/templates.js";

export class ChooseSessions {
    public static chooseSessionsButton(scrapbookId: string) {
        return [
            {
                type: "section",
                text: {
                    type: "plain_text",
                    text: t('scrapbook.prompt.select_sessions', {}),
                    emoji: true,
                },
            },
            {
                type: "actions",
                block_id: "actions",
                elements: [
                    {
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "choose sessions",
                            emoji: true,
                        },
                        value: JSON.stringify({ scrapbookId }),
                        action_id: Actions.CHOOSE_SESSIONS,
                    },
                ],
            },
        ];
    }

    public static chooseSessionsModal(sessions: Session[], scrapbookId: string): View {
        if (sessions.length === 0) {
            return {
                type: "modal" as const,
                private_metadata: scrapbookId,
                title: {
                    type: "plain_text" as const,
                    text: "choose sessions",
                    emoji: true,
                },
                close: {
                    type: "plain_text" as const,
                    text: "cancel",
                    emoji: true,
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "plain_text",
                            text: t('scrapbook.modal.sessions_not_found', {}),
                            emoji: true,
                        },
                    },
                ]
            };
        }

        return {
            type: "modal" as const,
            callback_id: Callbacks.CHOOSE_SESSIONS,
            private_metadata: scrapbookId,
            title: {
                type: "plain_text" as const,
                text: "choose sessions",
                emoji: true,
            },
            submit: {
                type: "plain_text" as const,
                text: "submit",
                emoji: true,
            },
            close: {
                type: "plain_text" as const,
                text: "cancel",
                emoji: true,
            },
            blocks: [
                // {
                //     type: "section",
                //     text: {
                //         type: "plain_text",
                //         text: t('scrapbook.modal.select_sessions', {}),
                //         emoji: true,
                //     },
                // },
                // {
                //     type: "divider",
                // },
                {
                    type: "section",
                    block_id: "sessions",
                    text: {
                        type: "mrkdwn",
                        text: t('scrapbook.modal.select_sessions', {}),
                    },
                    accessory: {
                        type: "multi_static_select",
                        placeholder: {
                            type: "plain_text",
                            text: "select sessions to link",
                            emoji: true,
                        },
                        options: sessions.map((session) => (
                            {
                                text: {
                                    type: "plain_text",
                                    text: `${session.metadata.work.substring(0, 30)} - ${session.createdAt.getMonth()}/${session.createdAt.getDate()}`,
                                    emoji: true,
                                },
                                value: session.id,
                            }
                        )),
                        action_id: "sessions",
                    },
                },
            ],
        };
    }

    public static completedSessions(sessions: Session[]): KnownBlock[] {
        return ([
            {
                type: "section",
                text: {
                    type: "plain_text",
                    text: t('scrapbook.prompt.complete', {}),
                    emoji: true,
                },
            },
            {
                type: "divider",
            }
        ] as KnownBlock[]).concat(sessions.map((session) => ({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*${session.createdAt.getMonth()}/${session.createdAt.getDate()}* - ${session.metadata.work}`,
            },
        })));
    }
}

export class Walkthrough { }

export class Shop {
    public static shop(remaining: number, pending: number, spent: number, banked: number, id: string): View {
        const blocks = [];

        blocks.push({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `Available to spend: ${remaining} :tw_admission_tickets:  _(Pending Approval: ${pending})_`
            }
        });

        if (spent !== 0) {
            blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `Total banked hours: ${banked} :tw_admission_tickets: `
                }
            });
        }

        blocks.push({
            "type": "divider"
        },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Open the Shop",
                            "emoji": true
                        },
                        'url': `${Environment.SHOP_URL}/arcade/${id}/shop/`,
                        // 'url': `https://forms.hackclub.com/eligibility?slack_id=${command.user_id}`,
                        //            "url": `${Environment.SHOP_URL}/arcade/${airtableUser.id}/shop/`,
                        // "action_id": Actions.OPEN_SHOP
                    }
                ],
                "block_id": "actions",
            });


        return {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "The Shop",
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