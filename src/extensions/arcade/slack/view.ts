import { KnownBlock, View } from "@slack/bolt";
import { Actions, Callbacks } from "../../../lib/constants.js";
import type { Session } from "@prisma/client";

export class ChooseSessions {
    public static chooseSessionsButton(scrapbookId: string) {
        return [
            {
                type: "section",
                text: {
                    type: "plain_text",
                    text: "Select which sessions should be linked to your scrapbook post!",
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
                            text: "Choose Sessions",
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
                    text: "Choose Sessions",
                    emoji: true,
                },
                close: {
                    type: "plain_text" as const,
                    text: "Cancel",
                    emoji: true,
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "plain_text",
                            text: "No Sessions Found!",
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
                text: "Choose Sessions",
                emoji: true,
            },
            submit: {
                type: "plain_text" as const,
                text: "Submit",
                emoji: true,
            },
            close: {
                type: "plain_text" as const,
                text: "Cancel",
                emoji: true,
            },
            blocks: [
                {
                    type: "section",
                    text: {
                        type: "plain_text",
                        text: "Choose one or more sessions that are associated with your scrapbook post!",
                        emoji: true,
                    },
                },
                {
                    type: "divider",
                },
                {
                    type: "section",
                    block_id: "sessions",
                    text: {
                        type: "mrkdwn",
                        text: "Select which sessions should be linked to your scrapbook post!",
                    },
                    accessory: {
                        type: "multi_static_select",
                        placeholder: {
                            type: "plain_text",
                            text: "Select sessions to link",
                            emoji: true,
                        },
                        options: sessions.map((session) => ({
                            text: {
                                type: "plain_text",
                                text: `${session.metadata.work} - ${session.createdAt.toDateString()}`,
                                emoji: true,
                            },
                            value: session.id,
                        })),
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
                    text: "Sweet! Your hours are now banked!",
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
                text: `*${session.createdAt.getMonth()}/${session.createdAt.getDate()}* - \n${session.metadata.work}`,
            },
        })));
    }
}