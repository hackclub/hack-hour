// Hours verification component
import { emitter } from "../../lib/emitter.js";
import { prisma } from "../../lib/prisma.js";
import { app } from "../../lib/bolt.js";

import { Constants } from "./constants.js"
import { Environment, Constants as GlobalConstants } from "../../lib/constants.js";
import { Verify } from "./views/verify.js";

import Airtable from "airtable";

let enableVerify = true;

Airtable.configure({
    apiKey: process.env.AIRTABLE_TOKEN
});

if (!process.env.AIRTABLE_BASE) {
    throw new Error('No AIRTABLE_BASE environment variable set');
}

const base = Airtable.base(process.env.AIRTABLE_BASE);
const sessionsTable = base('V2: Sessions');

emitter.on('setFlag', (flag, value) => {
    if (flag === 'enableVerify') {
        enableVerify = value;
    }
});

emitter.on('complete', async (session) => {
    if (!enableVerify) return;
    
    // Send a message in the verification channel
    const alert = await app.client.chat.postMessage({
        channel: Constants.VERIFIER_CHANNEL,
        text: `Session complete for <@${session.userId}>`,
        blocks: await Verify.verifyAlert(session)
    });

    await prisma.verifiedSession.create({
        data: {
            session: {
                connect: {
                    messageTs: session.messageTs
                }
            },
            verifiedBy: "",

            verified: false,

            metadata: {
                alertTs: alert.ts
            }
        }
    });
});

emitter.on('cancel', async (session) => {
    if (!enableVerify) return;

    // Send a message in the verification channel
    const alert = await app.client.chat.postMessage({
        channel: Constants.VERIFIER_CHANNEL,
        text: `Session cancelled for <@${session.userId}>`,
        blocks: await Verify.verifyAlert(session)
    });

    await prisma.verifiedSession.create({
        data: {
            session: {
                connect: {
                    messageTs: session.messageTs
                }
            },
            verifiedBy: "",

            verified: false,

            metadata: {
                alertTs: alert.ts
            }
        }
    });    
});

app.event('reaction_added', async ({ event }) => {
    if (!enableVerify) return;

    // Check if :white_check_mark: reaction was added in the main channel - all messages with those are considered verified
    if (!Constants.VERIFIERS?.includes(event.user)) return;

    if (event.reaction === 'white_check_mark' && event.item.channel === Environment.MAIN_CHANNEL) {
        const session = await prisma.session.findUnique({
            where: {
                messageTs: event.item.ts,
                verifiedSession: {
                    verified: false
                },
                OR: [{
                    completed: true
                }, {
                    cancelled: true
                }]
            },
            include: {
                user: {                    
                    include: {
                        slackUser: true
                    }
                }
            }
        });

        if (!session) {
            // Just assume that the message was not a session message
            return;
        }

        if (!session.user.slackUser) {
            return;
        }

        console.log(`Session verified for ${session.userId}`);

        const verifiedSession = await prisma.verifiedSession.update({
            where: {
                sessionId: session.messageTs
            },
            data: {
                verified: true,
                verifiedBy: event.user
            }
        });

        const alertTs = (verifiedSession.metadata as any).alertTs;

        await app.client.chat.update({
            channel: Constants.VERIFIER_CHANNEL,
            ts: alertTs,
            text: `Session verified for <@${session.user.slackUser?.slackId}>`,
            blocks: await Verify.completeVerify(session)
        });

        const userInfo = await app.client.users.info({
            user: session.user.slackUser?.slackId
        });

        if (!userInfo.user) {
            return;
        }

        const permalink = await app.client.chat.getPermalink({
            channel: Environment.MAIN_CHANNEL,
            message_ts: session.messageTs
        });

        if (!permalink.permalink) {
            return;
        }

        await sessionsTable.create([{
            "fields": {
              "Timestamp": verifiedSession.sessionId,
              "Name": userInfo.user.real_name,
              "Work": (session.metadata as any).work,
              "Minutes": session.elapsed,
              "Code URL": permalink.permalink,
              "Slack ID": session.user.slackUser?.slackId,
              "Internal ID": session.user.id
            }
        }]);

        console.log(`✅ Session ${session.messageTs} verified for ${session.userId}`);
    }
});

app.command('/_admin_toggleverify', async ({ ack, body }) => {
    if (!Constants.VERIFIERS?.includes(body.user_id)) {
        return;
    }

    await ack();

    enableVerify = !enableVerify;

    await app.client.chat.postMessage({
        channel: body.channel_id,
        text: `Verification is now ${enableVerify ? 'enabled' : 'disabled'}`
    });
});