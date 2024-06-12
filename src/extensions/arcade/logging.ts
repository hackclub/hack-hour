import { prisma, uid } from "../../lib/prisma.js";
import { Session } from "@prisma/client";
import { AirtableAPI } from "./lib/airtable.js";
import { app } from "../../lib/bolt.js";
import { Environment } from "../../lib/constants.js";
import { emitter } from "../../lib/emitter.js";

import { log } from "./lib/log.js";

const registerSession = async (session: Session) => {
    const user = await prisma.user.findUniqueOrThrow({
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

        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                metadata: user.metadata
            }
        });
    }
        
    console.log(`Fetched or created user ${user.metadata.airtable.id}`);
    log(`Fetched or created user ${user.metadata.airtable.id}`);

    // Check if the user posted anything in the thread
    const evidence = await app.client.conversations.replies({
        channel: Environment.MAIN_CHANNEL,
        ts: session.messageTs
    });

    if (!evidence.messages) { throw new Error(`No evidence found for ${session.messageTs}`); }

    const evidenced = evidence.messages.filter(message => message.user === user.slackUser!.slackId).length > 0;

    const permalink = await app.client.chat.getPermalink({
        channel: Environment.MAIN_CHANNEL,
        message_ts: session.messageTs
    });

    if (!permalink.permalink) { throw new Error(`No permalink found for ${session.messageTs}`); }

    // Create a new session
    const { id: sid, fields: sfields } = await AirtableAPI.Session.create({
        "Code URL": permalink.permalink,
        "User": [user.metadata.airtable.id],
        "Work": (session.metadata as any).work,
        "Minutes": session.elapsed,
        "Status": "Unreviewed",
        "Created At": session.createdAt.toISOString(),
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

    await prisma.transaction.create({
        data: {
            id: uid(),
            type: "session",
            amount: session.elapsed,
            
            user: {
                connect: {
                    id: user.id
                }
            },

            session: {
                connect: {
                    id: session.id
                }
            },

            data: {}
        }
    });
};

emitter.on('cancel', registerSession);
emitter.on('complete', registerSession);