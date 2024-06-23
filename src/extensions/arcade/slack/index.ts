import { Slack, approvedUsers } from "../../../lib/bolt.js";
import { Actions, Commands, Constants } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { AirtableAPI } from "../../../lib/airtable.js";
import { pfps } from "../../../lib/templates.js";
import { firstTime } from "../watchers/hackhour.js";

Slack.action(Actions.NO_ACTION, async ({}) => {});

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
    } else if (subCommand === 'hack' || subCommand === 'clearme') {
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

        if (subCommand === 'hack') {
            await firstTime(slackUser.user);
        }
    } else {
        Slack.chat.postEphemeral({
            user: command.user_id,
            channel: command.channel_id,
            text: `Unknown subcommand: ${subCommand}\nUsage: /admin [yap|reply|pfp]`,
        });
    }
});

// Slack.action(Actions.OPEN_SHOP, async () => {});
