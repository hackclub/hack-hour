import { Slack, app } from "../../../lib/bolt.js";
import { Actions, Callbacks } from "../../../lib/constants.js";
import { ChooseSessions } from "./view.js";
import { prisma } from "../../../lib/prisma.js";
import { AirtableAPI } from "../lib/airtable.js";
import { log } from "../lib/log.js";

Slack.action(Actions.CHOOSE_SESSIONS, async ({ ack, body }) => {
    await ack();

    if (body.type !== "block_actions") return;

    const flowTs = body.message!.ts;

    const scrapbook = await prisma.scrapbook.findUniqueOrThrow({
        where: {
            flowTs,
        }
    });

    // Get the latest post
    const scrapbooks = await prisma.scrapbook.findMany({
        where: {
            userId: scrapbook?.userId,
        },
        select: {
            createdAt: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    const sessions = await prisma.session.findMany({
        where: {
            userId: scrapbook?.userId,
            completed: true,
            createdAt: {
                // Before today & after the last post  
                // Assuming the latest post is the last post (scrapbook)
                // gte: scrapbooks.length > 1 ?  scrapbooks[1].createdAt : undefined,
                // lte: scrapbook?.createdAt,
            },
            metadata: {
                path: ["airtable", "status"],
                not: "Banked",
            }
        },
    });

    log(`\`\`\`${JSON.stringify(sessions, null, 2)}\`\`\``)

    await app.client.views.open({
        trigger_id: body.trigger_id,
        view: ChooseSessions.chooseSessionsModal(sessions, scrapbook?.internalId),
    });
});

Slack.view(Callbacks.CHOOSE_SESSIONS, async ({ ack, body, view }) => {
    await ack();

    const scrapbook = await prisma.scrapbook.findUniqueOrThrow({
        where: {
            internalId: view.private_metadata,
        }
    });

    const selectedSessionIds =
        view.state.values.sessions.sessions.selected_options?.map(
            (option: any) => option.value
        );

    if (!selectedSessionIds) {
        await app.client.chat.postEphemeral({
            user: body.user.id,
            channel: body.user.id,
            text: "No sessions selected. Please try again.",
        });
        return;
    }

    let bankedSessions = 0;

    // for (const sessionId of selectedSessions) {
    //     const update = {
    //         Scrapbook: [body.view.private_metadata],
    //     } as any;

    //     const session = await AirtableAPI.Session.find(sessionId);

    //     if (session?.fields.Status === "Approved") {
    //         update["Status"] = "Banked";
    //         bankedSessions++;
    //     }

    //     await AirtableAPI.Session.update(sessionId, update);
    // }
    const selectedSessions = await prisma.session.findMany({
        where: {
            id: {
                in: selectedSessionIds,
            },
        },
    });
    
    for (const session of selectedSessions) {        
        if (session.metadata?.airtable?.status === "Approved") {
            await prisma.session.update({
                where: {
                    id: session.id,
                },
                data: {
                    metadata: {
                        ...session.metadata,
                        airtable: {
                            ...session.metadata?.airtable,
                            status: "Banked",
                        },
                    },
                },
            });

            await AirtableAPI.Session.update(session.metadata?.airtable?.id, {
                "Scrapbook": [scrapbook.data.record],
                "Status": "Banked",
            });

            bankedSessions++;
        } else {
            await AirtableAPI.Session.update(session.metadata?.airtable?.id!, {
                "Scrapbook": [scrapbook.data.record],
            });
        }
    }

    await app.client.chat.update({
        channel: scrapbook.channel,
        ts: scrapbook.flowTs,
        text: "🎉 Sessions linked!",
        blocks: ChooseSessions.completedSessions(selectedSessions),
    });

    await app.client.chat.postMessage({
        channel: scrapbook.channel,
        text: `🎉 Congratulations! Your sessions have been linked to your scrapbook post, and ${bankedSessions} session${bankedSessions === 1 ? " has" : "s have"
            } been marked as banked.`,
    });
});

// app.command(Commands.SESSIONS, async ({ command, ack }) => {
//     await ack();

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