import { KnownBlock, View } from "@slack/bolt";
import { Actions, Callbacks } from "../../../../lib/constants.js";
import type { Session } from "@prisma/client";
import { t } from "../../../../lib/templates.js";

export class ChooseSessions {
    public static chooseSessionsButton(scrapbookId: string): KnownBlock[] {
        return [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: t('scrapbook.prompt.select_sessions'),
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
                            text: t('scrapbook.modal.sessions_not_found'),
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
                //         text: t('scrapbook.modal.select_sessions'),
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
                        text: t('scrapbook.modal.select_sessions'),
                    },
                    accessory: {
                        type: "multi_static_select",
                        placeholder: {
                            type: "plain_text",
                            text: "select sessions to link",
                            emoji: true,
                        },
                        options: sessions.map((session) => {
                            const work = session.metadata.work.length > 50 ? session.metadata.work.substring(0,47) + '...' : session.metadata.work;

                            return {
                                text: {
                                    type: "plain_text",
                                    text: `${work} - ${session.createdAt.getMonth() + 1}/${session.createdAt.getDate()}`,
                                    emoji: true,
                                },
                                description: {
                                    type: "plain_text",
                                    text: `Goal: ${session.goal.name}`,
                                },
                                value: session.id,
                            }
                        }),
                        max_selected_items: 25,
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
                    text: t('scrapbook.prompt.complete'),
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
                text: `*${session.createdAt.getMonth() + 1}/${session.createdAt.getDate()}* - ${session.metadata.work}`,
            },
        })));
    }
}
