/*
import Airtable from "airtable";

import { emitter } from "../../lib/emitter.js";
import { app } from "../../lib/bolt.js";
import { prisma } from "../../lib/prisma.js";
import { formatHour } from "../slack/lib/templates.js";
import { Environment } from "../../lib/constants.js";

import { Actions, Callbacks, Ship } from "./view.js";

/*
How it works:
- User sends a ship (a message in the ship channel
- The bot responds with a ship message and a button to open modals
- The modal asks the user which goal they want to complete
- The user selects a goal
- The bot updates the message with the goal selected
- The bot updates the goal in the database
- The bot updates an external database (airtable)
*//*
 
type AirtableUser = {
    "Name": string,
    "Internal ID": string,
    "Slack ID": string,
}

type AirtableSession = {
    "Timestamp": string,
    "V2: Users": [
        string
    ],
    "Work": string,
    "Minutes": number,
    "Code URL": string
}

Airtable.configure({
    apiKey: process.env.AIRTABLE_TOKEN
});

const base = Airtable.base('app1VxI7f3twOIs2g')
const users = base('V2: Users');
const sessions = base('V2: Sessions');

emitter.on('init', async () => {
    console.log('🚢 Ship Subroutine Initialized!');
});

/*
emitter.on('complete', async (session) => {
    // Check if the user is in the users base
    const user = await users.select({
        filterByFormula: `{Internal ID} = '${session.userId}'`
    }).firstPage();

    let userRecord;

    if (!user.length) {
        // Add the user to the airtable
        const userDB = await prisma.user.findUnique({
            where: {
                id: session.userId
            },
            include: {
                slackUser: true
            }
        });

        if (!userDB || !userDB.slackUser) { return };
        if (!session.metadata) { return };

        const userInfo = await app.client.users.info({
            user: userDB.slackUser.slackId
        });

        if (!userInfo.user) { emitter.emit('error', `User ${userDB.slackUser.slackId} not found`); return };

        userRecord = (await users.create([{
            "fields": {
                "Name": userInfo.user.real_name,
                "Internal ID": userDB.id,
                "Slack ID": userDB.slackUser.slackId,
            } as AirtableUser
        }]))[0];
    } else {
        userRecord = (await users.select({
            filterByFormula: `{Internal ID} = '${session.userId}'`
        }).firstPage())[0];
    }

    const codeURL = (await app.client.chat.getPermalink({
        channel: Environment.SHIP_CHANNEL,
        message_ts: session.messageTs
    })).permalink;

    await sessions.create([{
        "fields": {
            "Timestamp": session.createdAt.toISOString(),
            "V2: Users": [userRecord.id],
            "Work": (session.metadata as any).work,
            "Minutes": session.elapsed,
            "Code URL": session.messageTs
        } as AirtableSession
    }]);
});

*//*
app.message(async ({ message, say }) => {
    if (message.channel !== Environment.SHIP_CHANNEL) return;
    if (!message.subtype || message.subtype !== 'file_share') return; // Needs to be a file share event

    const { text, ts, user } = message;

    const slackUser = await prisma.slackUser.findUnique({
        where: {
            slackId: user
        },
        include: {
            user: true
        }
    });

    if (!slackUser) return;

    const response = await app.client.chat.postMessage({
        channel: Environment.SHIP_CHANNEL,
        text: `:ship: ${text}!!!!`,
        blocks: [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `:ship: ${text}!!!!`
                },
                accessory: {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Complete Goal"
                    },
                    "action_id": Actions.GOAL_COMPLETE,
                    "value": slackUser.user.id
                }
            }
        ],
        thread_ts: ts
    });

    if (!response) return;
    
    const meta: any = slackUser.user.metadata;

    meta.shipPosts = meta.shipPosts ? meta.shipPosts : [];

    meta.shipPosts.push({
        postTs: ts,
        responseTs: response.ts
    });

    await prisma.user.update({
        where: {
            id: slackUser.user.id
        },
        data: {
            metadata: meta
        }
    });
});

app.action(Actions.GOAL_COMPLETE, async ({ ack, body, client }) => {
    ack();

    const slackId = (body as any).user.id;
    const userId = JSON.parse((body as any).actions[0].value);

    const user = await prisma.user.findUnique({
        where: {
            id: userId
        },
        include: {
            slackUser: true
        }
    });

    if (!user) return;
    if (!user.slackUser) return;

    if (slackId !== user.slackUser.slackId) {
        await client.chat.postEphemeral({
            channel: slackId,
            text: `You can't complete another user's goal!`,
            user: slackId,
            thread_ts: (body as any).message.ts
        });

        return;
    }

    const responseTs = (body as any).message.ts;

    const meta: any = user.metadata;
    if (!meta.shipPosts) return;

    const shipPost = meta.shipPosts.find((post: any) => post.responseTs === responseTs);

    if (!shipPost) return;

    await client.views.open({
        trigger_id: (body as any).trigger_id,
        view: await Ship.completeModal(userId)
    });
});
*/