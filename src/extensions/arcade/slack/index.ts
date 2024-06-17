import { Slack, app, approvedUsers } from "../../../lib/bolt.js";
import { Actions, Callbacks, Commands, Constants } from "../../../lib/constants.js";
import { ChooseSessions } from "./view.js";
import { prisma } from "../../../lib/prisma.js";
import { AirtableAPI } from "../lib/airtable.js";
import { log } from "../lib/log.js";
import { pfps } from "../../../lib/templates.js";
import { Hack } from "../../slack/views/hack.js";
import { emitter } from "../../../lib/emitter.js";
import { firstTime } from "../watchers/hackhour.js";

Slack.action(Actions.CHOOSE_SESSIONS, async ({ ack, body }) => {
    await ack();

    if (body.type !== "block_actions") return;

    const flowTs = body.message!.ts;

    const scrapbook = await prisma.scrapbook.findUniqueOrThrow({
        where: {
            flowTs,
        }
    });

    // // Get the latest post
    // const scrapbooks = await prisma.scrapbook.findMany({
    //     where: {
    //         userId: scrapbook?.userId,
    //     },
    //     select: {
    //         createdAt: true,
    //     },
    //     orderBy: {
    //         createdAt: "desc",
    //     },
    // });

    const sessions = await prisma.session.findMany({
        where: {
            userId: scrapbook?.userId,
            // createdAt: {
            //     // Before today & after the last post  
            //     // Assuming the latest post is the last post (scrapbook)
            //     gte: scrapbooks.length > 1 ?  scrapbooks[1].createdAt : undefined,
            //     lte: scrapbook?.createdAt,
            // },
            metadata: {
                path: ["banked"],
                equals: false,
            },

            OR: [
                {
                    completed: true
                },
                {
                    cancelled: true
                }
            ]
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

    const selectedSessions = await prisma.session.findMany({
        where: {
            id: {
                in: selectedSessionIds,
            },
        },
    });
    
    for (const session of selectedSessions) {        
        if (session.metadata?.airtable?.status === "Approved") {
            session.metadata.airtable.status = "Banked";

            await AirtableAPI.Session.update(session.metadata?.airtable?.id, {
                "Scrapbook": [scrapbook.data.record],
                "Status": "Banked",
            });
        } else {
            await AirtableAPI.Session.update(session.metadata?.airtable?.id!, {
                "Scrapbook": [scrapbook.data.record],
            });
        }

        session.metadata.banked = true;

        await prisma.session.update({
            where: {
                id: session.id,
            },
            data: {
                metadata: session.metadata,
            },
        });

        bankedSessions++;
    }

    await app.client.chat.update({
        channel: scrapbook.flowChannel,
        ts: scrapbook.flowTs,
        text: "🎉 Sessions linked!",
        blocks: ChooseSessions.completedSessions(selectedSessions),
    });

    await app.client.chat.postMessage({
        channel: scrapbook.flowChannel,
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

let pfp: string = "none";
Slack.command(Commands.ADMIN, async ({ command }) => {
    if (approvedUsers.includes(command.user_id) === false) {
        await Slack.chat.postEphemeral({
            user: command.user_id,
            channel: command.channel_id,
            text: "You are not authorized to use this command",
        });
        return;
    }
    
    const subCommand = command.text.split(" ")[0];
    const subArgs = command.text.split(" ").slice(1);

    if (subCommand === 'yap') {
        Slack.chat.postMessage({
            channel: command.channel_id,
            text: subArgs.join(" "),
            username: Constants.USERNAME,
            icon_emoji: pfps[pfp as keyof typeof pfps],
        });
    } else if (subCommand === 'reply') {
        // Extract the message ts & channel from the command
        // subArgs[0] = https://hackclub.slack.com/archives/C07445ZSW2K/p1718503172963599
        const url = new URL(subArgs[0]);
        const channel = url.pathname.split("/")[2];
        const unformattedTs = url.pathname.split("/")[3]; // p1718503501981769 -> 1718503501.981769
        const ts = unformattedTs.slice(1, 11) + "." + unformattedTs.slice(11);

        Slack.chat.postMessage({
            channel,
            thread_ts: ts,
            text: subArgs.slice(1).join(" "),
            username: Constants.USERNAME,            
            icon_emoji: pfps[pfp as keyof typeof pfps],
        });
    } else if (subCommand === 'pfp') {
        if (subArgs.length === 0) {
            Slack.chat.postEphemeral({
                user: command.user_id,
                channel: command.channel_id,
                text: `Current pfp: ${pfp}\nPfps available: [${Object.keys(pfps).join(", ")}]`,
            });
            return;
        }

        if (Object.keys(pfps).includes(subArgs[0]) || subArgs[0] === "none") {
            pfp = subArgs[0];           
        }

        Slack.chat.postEphemeral({
            user: command.user_id,
            channel: command.channel_id,
            text: `Pfp set to ${pfp}`,
        });
    } else if (subCommand === 'hack') {
        const slackUser = await prisma.slackUser.findUnique({
            where: {
                slackId: command.user_id,
            },
            include: {
                user: true,
            }
        });

        if (!slackUser) {
            await Slack.chat.postEphemeral({
                user: command.user_id,
                channel: command.channel_id,
                text: "User not found",
            });
            return;
        }

        if (slackUser.user.metadata.airtable) {
            const airtableUser = await AirtableAPI.User.lookupBySlack(slackUser.slackId);

            if (airtableUser) {
                await AirtableAPI.User.delete(airtableUser.id);
            }
        }

        slackUser.user.metadata.firstTime = true;
        slackUser.user.metadata.airtable = undefined;

        await prisma.user.update({
            where: {
                id: slackUser.user.id,
            },
            data: {
                metadata: slackUser.user.metadata,
            }
        });

        await prisma.session.deleteMany({
            where: {
                userId: slackUser.user.id,
            }
        });

        await Slack.chat.postEphemeral({
            user: command.user_id,
            channel: command.channel_id,
            text: "i have no recollection of who you are...",
        });

        await firstTime(slackUser.user);
    } else {
        Slack.chat.postEphemeral({
            user: command.user_id,
            channel: command.channel_id,
            text: `Unknown subcommand: ${subCommand}\nUsage: /admin [yap|reply|pfp]`,
        });
    }
});

// Slack.action(Actions.OPEN_SHOP, async ({ ack, body }) => {
//     // Close the modal
//     await ack();
// });