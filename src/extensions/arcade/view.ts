import { Actions, Callbacks } from "../../lib/constants.js";
import type { Session } from "@prisma/client";

export class ChooseSessions {
  public static chooseSessionsButton(slackId: string, scrapbookId: string) {
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
            value: JSON.stringify({ slackId, scrapbookId }),
            action_id: Actions.CHOOSE_SESSIONS,
          },
        ],
      },
    ];
  }

  public static chooseSessionsModal(sessions: Session[], scrapbookId: string) {
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
            options: sessions.map((s) => ({
              text: {
                type: "mrkdwn",
                text: `**${s.metadata.work}** - ${s.createdAt.toDateString()}`,
                emoji: true,
              },
              value: s.metadata.airtable?.id!,
            })),
            action_id: "sessions",
          },
        },
      ],
    };
  }
}
