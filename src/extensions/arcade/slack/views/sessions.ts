import { Session } from "@prisma/client";
import { KnownBlock, View } from "@slack/bolt";
import { Slack } from "../../../../lib/bolt.js";
import { Actions, Environment } from "../../../../lib/constants.js";
import { AirtableAPI } from "../../../../lib/airtable.js";
                           
export class Sessions {
    public static async sessions(sessions: Session[], page: number, error: string | null = null): Promise<View> {
        const blocks: KnownBlock[] = [];

        for (let session of sessions) {
            const permalink = await Slack.chat.getPermalink({
                channel: Environment.MAIN_CHANNEL,
                message_ts: session.messageTs
            });

            const airtableSession = await AirtableAPI.Session.find(session.metadata?.airtable?.id!);

            const status = airtableSession?.fields["Status"];
            const approved = status === "Approved";
            const banked = status === "Banked";

            blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*${session.createdAt.getMonth()}/${session.createdAt.getDate()}*
${session.metadata?.work}
*Status: ${airtableSession?.fields["Status"]}*${airtableSession?.fields["Reason"] ? `- ${airtableSession?.fields["Reason"]}` : ""}
${
    approved ? `*Has Scrapbook?*: ${
        banked ? `yup!` : `noo ):`
    }` : ``
}
${
    (approved || banked) ? 
    `*Percent Approved*: ${(airtableSession?.fields["Percentage Approved"] || 0) * 100}%` : ``
}

<${permalink?.permalink}|View Session>`
                }
            }, {
                type: "divider"
            });
        }

        blocks.push(
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "previous"
                        },
                        "action_id": Actions.SESSIONS_PREVIOUS
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "next"
                        },
                        "action_id": Actions.SESSIONS_NEXT
                    }
                ]
            }
        );
        
        blocks.push(
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": `Page ${page + 1}\n${error ? `:warning: ${error}` : ``}`
                    }
                ]
            }
        );

        return {
            type: "modal",
            title: {
                type: "plain_text",
                text: "sessions",
            },
            close: {
                type: "plain_text",
                text: "close",
            },
            blocks,
            private_metadata: page.toString(),
        }
    }
}