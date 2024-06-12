import { prisma, uid } from "../../../lib/prisma.js";
import { Session } from "@prisma/client";
import { AirtableAPI } from "../lib/airtable.js";
import { app } from "../../../lib/bolt.js";
import { Environment } from "../../../lib/constants.js";
import { emitter } from "../../../lib/emitter.js";

import getUrls from "get-urls";

import { log } from "../lib/log.js";

const registerSession = async (session: Session) => {
    try {
        let user = await prisma.user.findUniqueOrThrow({
            where: {
                id: session.userId
            },
            include: {
                slackUser: true
            }
        });

        if (!user.slackUser) { throw new Error(`Slack user not found for ${user.id}`); }

        if (!user.metadata.airtable) {
            // Add the user to the Airtable
            const slackLookup = await app.client.users.info({
                user: user.slackUser.slackId
            });

            const { id } = await AirtableAPI.User.create({
                "Hack Hour ID": user.id,
                "Name": slackLookup.user!.real_name!,
                "Slack ID": user.slackUser.slackId,
            });

            user.metadata.airtable = {
                id
            };

            user = await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    metadata: user.metadata
                },
                include: {
                    slackUser: true
                }
            });

            if (!user.metadata.airtable) { throw new Error(`Airtable user not found for ${user.id}`); }
        }
            
        console.log(`Fetched or created user ${user.metadata.airtable.id}`);
        log(`Fetched or created user ${user.metadata.airtable.id}`);

        // Check if the user posted anything in the thread
        const evidence = await app.client.conversations.replies({
            channel: Environment.MAIN_CHANNEL,
            ts: session.messageTs
        });

        if (!evidence.messages) { throw new Error(`No evidence found for ${session.messageTs}`); }

        const activity = evidence.messages.filter(message => message.user === user.slackUser!.slackId).length > 0;

        // Borrowed from david's code, thanks david!
        const urlsExist = evidence.messages.find(message => getUrls(message.text ? message.text : "").size > 0)
        const imagesExist = evidence.messages.find(message => message.files ? message.files.length > 0 : false)

        const evidenced = urlsExist !== undefined || imagesExist !== undefined;

        const permalink = await app.client.chat.getPermalink({
            channel: Environment.MAIN_CHANNEL,
            message_ts: session.messageTs
        });

        if (!permalink.permalink) { throw new Error(`No permalink found for ${session.messageTs}`); }

        // Create a new session
        const { id: sid, fields: sfields } = await AirtableAPI.Session.create({
            "Code URL": permalink.permalink,
            "Session ID": session.id,
            "Message TS": session.messageTs,
            "Control TS": session.controlTs,
            "User": [user.metadata.airtable.id],
            "Work": (session.metadata as any).work,
            "Minutes": session.elapsed,
            "Status": "Unreviewed",
            "Created At": session.createdAt.toISOString(),
            "Activity": activity,
            "Evidenced": evidenced,
        });

        console.log(`Registered session ${session.id} for ${user.metadata.airtable.id} in the Airtable`);
        log(`Registered session ${session.id} for ${user.metadata.airtable.id} in the Airtable`);

        const updatedSession = await prisma.session.findUniqueOrThrow({
            where: {
                id: session.id
            }
        });

        updatedSession.metadata.airtable = {
            id: sid,
            status: "Unreviewed",
            reason: ""
        };
        
        await prisma.session.update({
            where: {
                id: session.id
            },
            data: {
                metadata: updatedSession.metadata
            }
        });

        // await prisma.transaction.create({
        //     data: {
        //         id: uid(),
        //         type: "session",
        //         amount: session.elapsed,
                
        //         user: {
        //             connect: {
        //                 id: user.id
        //             }
        //         },

        //         session: {
        //             connect: {
        //                 id: session.id
        //             }
        //         },

        //         data: {}
        //     }
        // });
    } catch (error) {
        emitter.emit('error', error);
    }
};

emitter.on('cancel', registerSession);
emitter.on('complete', registerSession);

app.event("message", async ({ event }) => {
    const thread_ts = (event as any).thread_ts;

    // Update the airtable to Re-review if any activity is detected
    if (thread_ts) {
        const session = await prisma.session.findFirstOrThrow({
            where: {
                messageTs: thread_ts
            },
            include: {
                user: {
                    select: {
                        slackUser: true
                    }
                }
            }
        });

        if (!session.metadata.airtable) { throw new Error(`Session ${session.id} is missing an Airtable ID`); }

        if (session) {
            const airtableSession = await AirtableAPI.Session.find(session.metadata.airtable.id);

            if (!airtableSession) {
                const permalink = (await app.client.chat.getPermalink({
                    channel: Environment.MAIN_CHANNEL,
                    message_ts: session.messageTs
                })).permalink;

                console.log(`Session ${permalink ? permalink : session.messageTs} not found in Airtable`);
                log(`Session ${permalink ? permalink : session.messageTs} not found in Airtable`);

                return;
            }

            if (!airtableSession.fields["Activity"]) {
                await app.client.chat.postEphemeral({
                    channel: Environment.MAIN_CHANNEL,
                    user: session.user.slackUser!.slackId,
                    text: `This session has been marked for re-review! Make sure to provide evidence for your work, including any code or media.`,
                });
            }

            if (!airtableSession.fields["Evidenced"]) {
                await app.client.chat.postEphemeral({
                    channel: Environment.MAIN_CHANNEL,
                    user: session.user.slackUser!.slackId,
                    text: `This session has been marked for re-review! Thanks for providing evidence for your work!`,
                });
            }

            if (airtableSession.fields["Status"] === "Rejected" || airtableSession.fields["Status"] === "Requested Re-review") {
                const user = await prisma.user.findUniqueOrThrow({
                    where: {
                        id: session.userId
                    },
                    include: {
                        slackUser: true
                    }
                });

                // Check if the user posted anything in the thread
                const evidence = await app.client.conversations.replies({
                    channel: Environment.MAIN_CHANNEL,
                    ts: session.messageTs
                });

                if (!evidence.messages) { throw new Error(`No evidence found for ${session.messageTs}`); }

                const activity = evidence.messages.filter(message => message.user === user.slackUser!.slackId).length > 0;

                // Borrowed from david's code, thanks david!
                const urlsExist = evidence.messages.find(message => getUrls(message.text ? message.text : "").size > 0)
                const imagesExist = evidence.messages.find(message => message.files ? message.files.length > 0 : false)

                const evidenced = urlsExist !== undefined || imagesExist !== undefined;

                await AirtableAPI.Session.update(session.metadata.airtable.id, {
                    "Status": "Requested Re-review",
                    "Activity": activity,
                    "Evidenced": evidenced
                });

                console.log(`Session ${session.id} updated to Re-review`);
                log(`Session ${session.id} updated to Re-review`);
            }
        }
    }
});