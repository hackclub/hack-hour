import { Session } from "@prisma/client";
import { KnownBlock, View } from "@slack/bolt";
import { Slack } from "../../../../lib/bolt.js";
import { Actions, Environment } from "../../../../lib/constants.js";
import { AirtableAPI } from "../../../../lib/airtable.js";
import { formatHour, pfps } from "../../../../lib/templates.js";
import { getElapsed, prisma } from "../../../../lib/prisma.js";
import { Loading } from "../../../slack/views/loading.js";

export class Sessions {
    public static async sessions(
        {
            userId,
            sessions,
            page,
            error
        }: {
            userId: string,
            sessions: Session[],
            page: number,
            error?: string
        }
    ): Promise<View> {
        const blocks: KnownBlock[] = [];

        if (page === -1 || sessions.length === 0) {
            // Show a overview instead of specific sessions
            const user = await prisma.user.findUnique({
                where: {
                    id: userId
                }
            });

            if (!user || !user.metadata.airtable) {
                return Loading.error("User not found");
            }

            const airtableUser = await AirtableAPI.User.find(user.metadata.airtable.id);

            if (!airtableUser) {
                return Loading.error("User not found");
            }
            blocks.push({
                type: "header",
                text: {
                    type: "plain_text",
                    text:
                        `You have ${airtableUser.fields['Balance (Hours)']} :tw_admission_tickets: remaining.`,
                    emoji: true
                }
            }, {
                type: "divider"
            }, {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text:
                        `
*Tickets earned: ${Math.floor(airtableUser.fields['Minutes (Banked)'] / 60)} :tw_admission_tickets:*
Minutes approved & qualifying for tickets: ${airtableUser.fields['Minutes (Banked)']} minutes (${formatHour(airtableUser.fields['Minutes (Banked)'])} hours)

*Tickets pending: ${Math.floor(airtableUser.fields['Minutes (Pending Approval)'] / 60)} :tw_admission_tickets:*
Minutes pending: ${airtableUser.fields['Minutes (Pending Approval)']} minutes (${formatHour(airtableUser.fields['Minutes (Pending Approval)'])} hours)

*Tickets rejected: ${Math.floor(airtableUser.fields['Minutes (Rejected)'] / 60)} :tw_admission_tickets:*
Rejected minutes: ${airtableUser.fields['Minutes (Rejected)']} minutes (${formatHour(airtableUser.fields['Minutes (Rejected)'])} hours)

_Lifetime minutes: ${airtableUser.fields['Minutes (All)']} minutes (${formatHour(airtableUser.fields['Minutes (All)'])} hours)_`
                }
            }, {
                type: "divider"
            }, {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text:
                        `Tickets spent: ${Math.floor(airtableUser.fields['Spent Incl. Pending (Minutes)'] / 60)} :tw_admission_tickets:`
                }
            }, {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "view sessions"
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
                            "text": `_i can be really laggy, sowwy ${pfps['cute']}_\n${error ? `:warning: ${error}` : ``}`
                        }
                    ]
                });

            return {
                type: "modal",
                title: {
                    type: "plain_text",
                    text: "overview",
                },
                close: {
                    type: "plain_text",
                    text: "close",
                },
                blocks,
                private_metadata: JSON.stringify({
                    page,
                    userId
                }),
            }
        }

        for (let session of sessions) {
            const permalink = await Slack.chat.getPermalink({
                channel: Environment.MAIN_CHANNEL,
                message_ts: session.messageTs
            });

            if (!session.metadata.airtable) {
                if (!session.cancelled || !session.completed) {
                    blocks.push({
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `*${session.createdAt.getMonth() + 1}/${session.createdAt.getDate()}* - ${getElapsed((session))} minutes\n${session.metadata?.work}\n*Status: In Progress*\n<${permalink?.permalink}|View Session>`
                        }
                    }, {
                        type: "divider"
                    });

                    continue;
                }

                blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${session.createdAt.getMonth() + 1}/${session.createdAt.getDate()}* - ${getElapsed(session)} minutes\n${session.metadata?.work}\n*Status: Not Found*\n<${permalink?.permalink}|View Session>`
                    }
                }, {
                    type: "divider"
                });

                continue;
            }

            const airtableSession = await AirtableAPI.Session.find(session.metadata.airtable.id);

            if (!airtableSession) {
                blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${session.createdAt.getMonth() + 1}/${session.createdAt.getDate()}* - ${getElapsed(session)} minutes\n${session.metadata?.work}\n*Status: Not Found*\n<${permalink?.permalink}|View Session>`
                    }
                }, {
                    type: "divider"
                });

                continue;
            }

            let status = airtableSession.fields["Status"];
            const banked = airtableSession.fields["Scrapbook Approved"];
            const approved = status === "Approved" || banked;

            if (status === "Banked") { status = "Approved"; }

            blocks.push(
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text:
                            `*${session.createdAt.getMonth() + 1}/${session.createdAt.getDate()}* - ${getElapsed(session)} minutes
${session.metadata?.work}
*Status: ${airtableSession.fields["Status"]}*${airtableSession.fields["Reason"] ? `- ${airtableSession.fields["Reason"]}` : ""}
${approved ? `*Has Scrapbook?*: ${banked ? `yup!` : `noo ):`}` : ``}

*Minutes Approved*: ${airtableSession.fields["Approved Minutes"]}

<${permalink?.permalink}|View Session>`
                    }
                }, {
                type: "divider"
            }
            );
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
                        "text": `_i can be really laggy, sowwy ${pfps['cute']}_\npage ${page + 1}\n${error ? `:warning: ${error}` : ``}`
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
            private_metadata: JSON.stringify({
                page,
                userId
            }),
        }
    }
}
