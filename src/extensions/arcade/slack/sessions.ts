import { Slack } from "../../../lib/bolt.js";
import { Actions, Commands } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { t } from "../../../lib/templates.js";
import { Loading } from "../../slack/views/loading.js";
import { Sessions } from "./views/sessions.js";

// app.command(Commands.SESSIONS, async ({ command, ack }) => {
//     const sessions = await prisma.session.findMany({
//         where: {
//             user: {
//                 slackUser: {
//                     slackId: command.user_id
//                 }
//             },
//             OR: [
//                 {
//                     completed: true
//                 },
//                 {
//                     cancelled: true
//                 }
//             ]
//         },
//         include: {
//             goal: true
//         }
//     });

//     if (sessions.length === 0) {
//         informUser(command.user_id, "No sessions found", command.channel_id);
//         return;
//     }

//     const blocks: KnownBlock[] = [];

//     for (let session of sessions) {
//         // Fetch the status from Airtable
//         if (!(session.metadata as any).airtable || !(session.metadata as any).airtable.id) {
//             blocks.push({
//                 "type": "section",
//                 "text": {
//                     "type": "mrkdwn",
//                     "text": `*${session.createdAt.getMonth()}/${session.createdAt.getDate()}*\n${(session.metadata as any).work}\n_Goal:_ ${session.goal?.name}\n*There was an error. Please send a message in #arcade-hour-bts. Reason: Missing airtable association.*\n<${(await app.client.chat.getPermalink({
//                             channel: Environment.MAIN_CHANNEL,
//                             message_ts: session.messageTs
//                         })).permalink
//                         }|View Session>`
//                 }
//             }, {
//                 "type": "divider"
//             });

//             continue;
//         }

//         console.log(`Fetching status for session ${session.messageTs} from Airtable - ${(session.metadata as any).airtable.id}`);

//         let airtableSession: any = null;

//         try {
//             airtableSession = await AirtableAPI.Session.fetch((session.metadata as any).airtable.id);
//         } catch (error) {
//             airtableSession = {
//                 fields: {
//                     "Status": "Error",
//                     "Reason": "Error fetching status from Airtable - please send a message in <#C06U5U9ADGD>"
//                 }
//             };
//         }

//         if (!airtableSession) {
//             airtableSession = {
//                 fields: {
//                     "Status": "Error",
//                     "Reason": "Error fetching status from Airtable - please send a message in <#C06U5U9ADGD>"
//                 }
//             };
//         }

//         session = await prisma.session.update({
//             where: {
//                 messageTs: session.messageTs
//             },
//             data: {
//                 metadata: {
//                     ...(session.metadata as any),
//                     airtable: {
//                         ...(session.metadata as any).airtable,
//                         status: airtableSession.fields["Status"],
//                         reason: airtableSession.fields["Reason"]
//                     }
//                 }
//             },
//             include: {
//                 goal: true
//             }
//         });

//         blocks.push({
//             "type": "section",
//             "text": {
//                 "type": "mrkdwn",
//                 "text": `*${session.createdAt.getMonth()}/${session.createdAt.getDate()}*\n${(session.metadata as any).work}\n_Goal:_ ${session.goal?.name}\n*${(session.metadata as any).airtable.status}${(session.metadata as any).airtable.reason ? `:* ${(session.metadata as any).airtable.reason}` : "*"
//                     }\n<${(await app.client.chat.getPermalink({
//                         channel: Environment.MAIN_CHANNEL,
//                         message_ts: session.messageTs
//                     })).permalink
//                     }|View Session>`
//             }
//         }, {
//             "type": "divider"
//         });
//     }

//     for (const block of blocks) {
//         await app.client.chat.postEphemeral({
//             user: command.user_id,
//             channel: command.channel_id,
//             blocks: [block]
//         });
//     }
// });

Slack.command(Commands.SESSIONS, async ({ command }) => {
    const view = await Slack.views.open({
        trigger_id: command.trigger_id,
        view: Loading.loading()
    });

    const slackUser = await prisma.slackUser.findUnique({
        where: {
            slackId: command.user_id,
        }
    });

    if (!slackUser) {
        await Slack.views.update({
            view_id: view?.view?.id,
            view: Loading.error(t("error.not_a_user"))
        })
        return;
    }

    const sessions = await prisma.session.findMany({
        where: {
            userId: slackUser.userId,
        },
        skip: 0,
        take: 3,
    });

    if (sessions.length === 0) {
        await Slack.views.update({
            view_id: view?.view?.id,
            view: Loading.error(t("error.first_time"))
        })
        return;
    }

    await Slack.views.update({
        view_id: view?.view?.id,
        view: await Sessions.sessions(sessions, 0)
    });
});

Slack.action(Actions.SESSIONS_PREVIOUS, async ({ body }) => {
    const view = (body as any).view;
    let page = parseInt(view.private_metadata);

    if (!page) {
        return;
    }

    page--;

    const sessions = await prisma.session.findMany({
        where: {
            userId: view.private_metadata,
        },
        skip: page <= 0 ? 0 : page * 3,
        take: 3,
    });

    if (page <= 0) {
        await Slack.views.update({
            view_id: view.id,
            view: await Sessions.sessions(sessions, page + 1, "Can't go back any further")
        });
    } else {
        await Slack.views.update({
            view_id: view.id,
            view: await Sessions.sessions(sessions, page)
        });
    }
});