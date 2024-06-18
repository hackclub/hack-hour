import { prisma } from "../../../lib/prisma.js";
import { Session, User } from "@prisma/client";
import { AirtableAPI } from "../../../lib/airtable.js";
import { app, Slack } from "../../../lib/bolt.js";
import { Constants, Environment } from "../../../lib/constants.js";
import { emitter } from "../../../lib/emitter.js";

import { log } from "../lib/log.js";
import { pfps, t, t_format, templates } from "../../../lib/templates.js";
import { fetchEvidence, surfaceEvidence } from "../lib/helper.js";
import { Session as LibSession } from "../../../lib/corelib.js";
import { handleError } from "../../../lib/handleError.js";

const findOrCreateUser = async (userId: string) => {
    try {
        let user = await prisma.user.findUniqueOrThrow({
            where: {
                id: userId
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

            // Check if the slack id already exists in the Airtable
            const airtableUserExists = await AirtableAPI.User.lookupBySlack(user.slackUser.slackId);

            let id;
            if (airtableUserExists) {
                // Assume the Arcadius already got to this person & has their information ready - all we need to do is create the association
                ({ id } = await AirtableAPI.User.update(airtableUserExists.id, {
                    "Internal ID": user.id,
                    // "Name": slackLookup.user!.real_name!,
                    "Slack ID": user.slackUser.slackId,
                }));
            } else {
                ({ id } = await AirtableAPI.User.create({
                    "Internal ID": user.id,
                    // "Name": slackLookup.user!.real_name!,
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

        return user;
    } catch (e) {
        handleError(e);
    }
};

const registerSession = async (session: Session) => {
    try {
        let user = await findOrCreateUser(session.userId);

        if (!user) { throw new Error(`User not found for ${session.userId}`); }

        if (user.metadata.firstTime) {
            // await app.client.chat.postMessage({
            //     channel: Environment.MAIN_CHANNEL,
            //     text: t('onboarding.complete', {
            //         slackId: user.slackUser!.slackId
            //     }),
            //     thread_ts: session.messageTs,
            // });

            user.metadata.firstTime = false;

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
        }

        if (!user.metadata.airtable) { throw new Error(`Airtable user not found for ${user.id}`); }

        console.log(`Fetched or created user ${user.metadata.airtable.id}`);
        log(`Fetched or created user ${user.metadata.airtable.id}`);

        const { activity, evidenced } = await fetchEvidence(session.messageTs, user.slackUser!.slackId);

        const permalink = await Slack.chat.getPermalink({
            channel: Environment.MAIN_CHANNEL,
            message_ts: session.messageTs
        });

        if (!permalink || !permalink.permalink) { throw new Error(`No permalink found for ${session.messageTs}`); }

        // Create a new session
        const { id: sid, fields: sfields } = await AirtableAPI.Session.create({
            "Code URL": permalink?.permalink,
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
            "First Time": session.metadata.firstTime ? true : false,
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

        if (airtableUser.fields['Minutes (Approved)'] < Constants.PROMOTION_THRESH && !evidenced && !session.metadata.firstTime) {
            await Slack.chat.postMessage({
                channel: Environment.MAIN_CHANNEL,
                user: user.slackUser!.slackId,
                text: t('evidence_reminder', {
                    slackId: user.slackUser!.slackId
                }),
                thread_ts: session.messageTs
            });
        }
    } catch (error) {
        handleError(error);
    }
};

emitter.on('cancel', registerSession);
emitter.on('complete', registerSession);

app.event("message", async ({ event }) => {
    const channel = (event as any).channel;
    const thread_ts = (event as any).thread_ts;

    if (channel !== Environment.MAIN_CHANNEL) { return; }

    // Update the airtable to Re-review if any activity is detected
    if (thread_ts) {
        const session = await prisma.session.findFirst({
            where: {
                messageTs: thread_ts
            },
            include: {
                user: {
                    select: {
                        slackUser: true,
                        metadata: true
                    }
                }
            }
        });

        if (!session) { return; }

        if ((event as any).user !== session.user.slackUser!.slackId) {
            return;
        }

        await surfaceEvidence(thread_ts, session.user.slackUser!.slackId);

        if (!session.metadata.airtable) { 
            if (session.metadata.firstTime && session.user.metadata.airtable) {
                // Use this as an alternative flow - the user is learning how hack hour works
                const airtableUser = await AirtableAPI.User.find(session.user.metadata.airtable.id);

                await Slack.chat.postMessage({
                    channel: Environment.MAIN_CHANNEL,
                    thread_ts: session.messageTs,
                    blocks: [
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": t('firstTime.walkthrough.complete', {
                                    slackId: session.user.slackUser!.slackId,
                                    minutes: session.elapsed
                                })
                            },
                            "accessory": {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "continue..."
                                },
                                "url": `https://hackclub.slack.com/archives/${airtableUser?.fields['dmChannel']}`
                            }
                        }
                    ]
                });

                const updatedSession = await prisma.session.update({
                    where: {
                        id: session.id
                    },
                    data: {
                        metadata: session.metadata,
                        cancelled: true
                    }
                });

                LibSession.cancel(updatedSession);

                return;
            }
            
            // throw new Error(`Session ${session.id} is missing an Airtable ID`); 
            return;
        }

        if (session) {
            const airtableSession = await AirtableAPI.Session.find(session.metadata.airtable.id);
 
            if (!airtableSession) {
                const permalink = (await Slack.chat.getPermalink({
                    channel: Environment.MAIN_CHANNEL,
                    message_ts: session.messageTs
                }))?.permalink;

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

            const { activity, evidenced } = await fetchEvidence(session.messageTs, user.slackUser!.slackId);

            if (!airtableSession.fields["Evidenced"] && evidenced) {
                await Slack.chat.postMessage({
                    channel: Environment.MAIN_CHANNEL,
                    user: session.user.slackUser!.slackId,
                    thread_ts: session.messageTs,
                    text: t('detect.evidence', {})
                });
            } else if (!airtableSession.fields["Activity"] && activity) {
                await Slack.chat.postMessage({
                    channel: Environment.MAIN_CHANNEL,
                    user: session.user.slackUser!.slackId,
                    thread_ts: session.messageTs,
                    text: t('detect.activity', {}),
                });
            }

            if ((airtableSession.fields["Status"] === "Rejected" || airtableSession.fields["Status"] === "Requested Re-review") && activity) {
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

// emitter.on('sessionUpdate', async (session: Session) => {
//     const slackUser = await prisma.slackUser.findUniqueOrThrow({
//         where: {
//             userId: session.userId
//         }
//     });

//     if ((session.time - session.elapsed) % 15 == 0 && session.elapsed > 0 && session.metadata.firstTime) {
//         // Send a reminder every 15 minutes
//         await Slack.chat.postMessage({
//             thread_ts: session.messageTs,
//             user: slackUser.slackId,
//             channel: Environment.MAIN_CHANNEL,
//             text: t(`onboarding.update`, {
//                 slackId: slackUser.slackId,
//                 minutes: session.time - session.elapsed
//             })
//         });
//     }
// });

export const firstTime = async (user: User) => {
    /*
    Check if arcadius made an entry in the airtable,
        - YES: just grab the conversation ID and DM the user
        - NO: create a new entry in the airtable, grab the conversation ID and DM the user
    */
    const slackUser = await prisma.slackUser.findUniqueOrThrow({
        where: {
            userId: user.id
        }
    });

    let airtableUser: Awaited<ReturnType<typeof AirtableAPI.User.lookupBySlack>> = null;

    try {
        airtableUser = await AirtableAPI.User.lookupBySlack(slackUser.slackId);
    } catch (error) {
        airtableUser = null;
    }

    if (!airtableUser) {
        const response = await fetch(
            Environment.ARCADIUS_URL + '/existing-user-start',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Environment.ARCADIUS_SECRET}`
                },
                body: JSON.stringify({
                    userId: slackUser.slackId
                })
            }
        )

        const data = await response.json();

        // const channelId = data.channelId;
        const airtableRecId = data.airtableRecId;

        await AirtableAPI.User.update(airtableRecId, {
            "Internal ID": user.id,
        });

        user.metadata.airtable = {
            id: airtableRecId,
        };

        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                metadata: user.metadata
            }
        });

        return true;
    } else if (!airtableUser.fields['Internal ID']) {
        await AirtableAPI.User.update(airtableUser.id, {
            "Internal ID": user.id,
        });
    }

    user.metadata.airtable = {
        id: airtableUser.id,
    };

    await prisma.user.update({
        where: {
            id: user.id
        },
        data: {
            metadata: user.metadata
        }
    });

    return false;
};

emitter.on('start', async (session: Session) => {
    try {
        await findOrCreateUser(session.userId);
        let user = await prisma.user.findUniqueOrThrow({
            where: {
                id: session.userId
            },
            include: {
                slackUser: {
                    select: {
                        slackId: true
                    }
                }
            }
        });

        

        if (!user.metadata.airtable) { throw new Error(`Airtable user not found for ${user.id}`); }

        if (user.metadata.firstTime) {
            const airtableUser = await AirtableAPI.User.find(user.metadata.airtable.id);

            if (!airtableUser) { throw new Error(`Airtable user not found for ${user.id}`); }

            const dmChannel = airtableUser.fields['dmChannel'];

            const permalink = await Slack.chat.getPermalink({
                channel: Environment.MAIN_CHANNEL,
                message_ts: session.messageTs
            });

            await Slack.chat.postMessage({
                channel: dmChannel,
                text: t('firstTime.start', {
                    slackId: user.slackUser!.slackId,
                    url: permalink?.permalink
                }),
                // username: Constants.USERNAME,
                // icon_emoji: pfps['woah']
            });
        }
    } catch (error) {
        handleError(error);
    }
});