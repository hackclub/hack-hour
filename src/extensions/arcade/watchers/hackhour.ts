import { prisma, uid } from "../../../lib/prisma.js";
import { Session } from "@prisma/client";
import { AirtableAPI } from "../lib/airtable.js";
import { app, Slack } from "../../../lib/bolt.js";
import { Constants, Environment } from "../../../lib/constants.js";
import { emitter } from "../../../lib/emitter.js";

import getUrls from "get-urls";

import { log } from "../lib/log.js";
import { t } from "../../../lib/templates.js";

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

        if (session.metadata.onboarding) {
            await app.client.chat.postMessage({
                channel: Environment.MAIN_CHANNEL,
                text: t('onboarding.complete', {
                    slackId: user.slackUser!.slackId
                }),
                thread_ts: session.messageTs
            });
        }

        if (!user.metadata.airtable) {
            // Add the user to the Airtable
            const slackLookup = await app.client.users.info({
                user: user.slackUser.slackId
            });

            // Check if the slack id already exists in the Airtable
            const airtableUserExists = await AirtableAPI.User.lookupBySlack(user.slackUser.slackId);

            let id;
            if (airtableUserExists) {
                ({ id } = await AirtableAPI.User.update(airtableUserExists.id, {
                    "Internal ID": user.id,
                    "Name": slackLookup.user!.real_name!,
                    "Slack ID": user.slackUser.slackId,
                }));                
            } else {
                ({ id } = await AirtableAPI.User.create({
                    "Internal ID": user.id,
                    "Name": slackLookup.user!.real_name!,
                    "Slack ID": user.slackUser.slackId,
                }));
            }

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

        const airtableUser = await AirtableAPI.User.find(user.metadata.airtable.id);

        if (!airtableUser) { throw new Error(`Airtable user not found for ${user.id}`); }

        if (airtableUser.fields['Minutes (Approved)'] < Constants.PROMOTION_THRESH && !evidenced) {
            await app.client.chat.postMessage({
                channel: Environment.MAIN_CHANNEL,
                user: user.slackUser!.slackId,
                text: t('onboarding.evidence_reminder', {
                    slackId: user.slackUser!.slackId
                }),
                thread_ts: session.messageTs
            });
        }
    } catch (error) {
        emitter.emit('error', error);
    }
};

emitter.on('cancel', registerSession);
emitter.on('complete', registerSession);

app.event("message", async ({ event }) => {
    const channel = (event as any).channel;
    const thread_ts = (event as any).thread_ts;

    if (channel !== Environment.MAIN_CHANNEL) { return; }

    console.log(thread_ts);

    // Update the airtable to Re-review if any activity is detected
    if (thread_ts) {
        const session = await prisma.session.findFirst({
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

        if (!session) { return; }

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

            if (!airtableSession.fields["Activity"] && activity) {
                await app.client.chat.postMessage({
                    channel: Environment.MAIN_CHANNEL,
                    user: session.user.slackUser!.slackId,
                    text: t('detect.activity', {}),
                });
            }

            if (!airtableSession.fields["Evidenced"] && evidenced) {
                await app.client.chat.postMessage({
                    channel: Environment.MAIN_CHANNEL,
                    user: session.user.slackUser!.slackId,
                    text: t('detect.evidence', {})
                });
            }

            if (airtableSession.fields["Status"] === "Rejected" || airtableSession.fields["Status"] === "Requested Re-review") {
                await AirtableAPI.Session.update(session.metadata.airtable.id, {
                    "Status": "Requested Re-review",
                    "Activity": activity,
                    "Evidenced": evidenced
                });

                console.log(`Session ${session.id} updated to Re-review`);
                log(`Session ${session.id} updated to Re-review`);
            } else {
                await AirtableAPI.Session.update(session.metadata.airtable.id, {
                    "Activity": activity,
                    "Evidenced": evidenced
                });                
            }
        }
    }
});

emitter.on('start', async (session: Session) => {
    try {
        const slackUser = await prisma.slackUser.findUniqueOrThrow({
            where: {
                userId: session.userId
            }
        });

        if (session.metadata.onboarding) {
            await app.client.chat.postMessage({
                channel: Environment.MAIN_CHANNEL,
                text: t('onboarding.init', {
                    slackId: slackUser.slackId
                }),
                thread_ts: session.messageTs
            });
        }
    } catch (error) {
        emitter.emit('error', error);
    }
});

emitter.on('sessionUpdate', async (session: Session) => {
    const slackUser = await prisma.slackUser.findUniqueOrThrow({
        where: {
            userId: session.userId
        }
    });

    if ((session.time - session.elapsed) % 15 == 0 && session.elapsed > 0 && session.metadata.onboarding) {
        // Send a reminder every 15 minutes
        await Slack.chat.postMessage({
            thread_ts: session.messageTs,
            user: slackUser.slackId,
            channel: Environment.MAIN_CHANNEL,
            text: t(`onboarding.update`, {
                slackId: slackUser.slackId,
                minutes: session.time - session.elapsed
            })
        });
    }
});