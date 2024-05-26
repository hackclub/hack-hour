import { app } from "../lib/bolt.js";
import { Environment } from "../lib/constants.js";
import { prisma, uid } from "../lib/prisma.js";
import { minuteInterval } from "../lib/interval.js";
import { t } from "../lib/templates.js";
import { handle } from "../lib/errors.js";

import { updateController, cancelSession } from "./slack/lib.js";

import "./slack/functions/pause.js";
import "./slack/functions/cancel.js";
import "./slack/functions/extend.js";

/*
Session Creation
*/
app.event("message", async ({ event }) => {
    try {
        const { subtype, channel, ts } = event;
        const thread_ts = (event as any).thread_ts
        const slackId = (event as any).user;

        if (thread_ts || channel != Environment.MAIN_CHANNEL) {
            return;
        }

        if (subtype && subtype != 'file_share') {
            return;
        }

        let slackUser = await prisma.slackUser.findUnique(
            {
                where: {
                    slackId,
                }
            }
        );

        if (!slackUser) {
            const slackUserData = await app.client.users.info({
                user: slackId
            });

            if (!slackUserData.user) {
                throw new Error(`Could not find user ${slackId}!`)
            } else if (!slackUserData.user.tz_offset) {
                throw new Error(`Could not retrieve timezone of ${slackId}`)
            }

            slackUser = await prisma.slackUser.create(
                {
                    data: {
                        slackId,
                        user: {
                            create: {
                                id: uid(),
                                lifetimeMinutes: 0,
                                apiKey: uid(),
                                goals: {
                                    create: {
                                        id: uid(),
                                        
                                        name: "No Goal",
                                        description: "A default goal for users who have not set one.",
                                      
                                        totalMinutes: 0,
                                        createdAt: new Date(),
                                      
                                        selected: true
                                    }
                                }
                            }
                        },
                        tz_offset: slackUserData.user.tz_offset
                    }
                }
            );        
        }

        // Cancel any existing sessions
        const existingSession = await prisma.session.findFirst({
            where: {
                userId: slackUser.userId,
                completed: false,
                cancelled: false
            }
        });

        if (existingSession) {
            await cancelSession(slackId, existingSession);
        }

        const user = await prisma.user.findUnique(
            {
                where: {
                    id: slackUser.userId
                }
            }
        );

        if (!user) {
            throw new Error(`User ${slackUser.userId} not found!`)
        }

        // Create a controller message in the thread
        const controller = await app.client.chat.postMessage({
            channel,
            thread_ts: ts,
            text: "Initalizing..." // Leave it empty, for initialization
        })

        if (!controller || !controller.ts) {
            throw new Error(`Failed to create a message for ${slackId}`)
        }

        const session = await prisma.session.create({
            data: {
                userId: user.id,
                messageTs: ts,
                controlTs: controller.ts,
                
                createdAt: new Date(),
                time: 60,
                elapsed: 0,
              
                completed: false,
                cancelled : false,
                paused: false,

                elapsedSincePause: 0
            }
        });

        await updateController(session);
    } catch (error) {
        handle(error);
    }
});

/*
Minute tracker
*/
minuteInterval.attach(async () => {
    try {
        const sessions = await prisma.session.findMany({
            where: {
                completed: false,
                cancelled: false,
                // slackUser of the user is optional. make sure it exists
                user: {
                    slackUser: {
                        isNot: null
                    }
                }
            }
        });

        console.log(`🕒 Updating ${sessions.length} sessions`);

        for (const session of sessions) {
            // Check if the message exists
            const message = await app.client.conversations.history({
                channel: Environment.MAIN_CHANNEL,
                latest: session.messageTs,
                limit: 1
            });

            if (message.messages == undefined || message.messages.length == 0) {
                console.log(`❌ Session ${session.messageTs} does not exist`);

                // Remove the session
                await prisma.session.delete({
                    where: {
                        messageTs: session.messageTs
                    }
                });

                continue;
            }

            const controllerTs = session.controlTs;

            const slackUser = await prisma.slackUser.findUnique({
                where: {
                    userId: session.userId
                }
            });

            if (!slackUser) {
                throw new Error(`Missing slack component of ${session.userId}`)
            }

            if (session.paused) {
                await prisma.session.update({
                    where: {
                        messageTs: session.messageTs
                    },
                    data: {
                        elapsedSincePause: {
                            increment: 1
                        }
                    }
                });
                
                await updateController(session);

                continue;
            } else if (session.elapsed >= session.time) { // TODO: Commit hours to goal, verify hours with events                
                const updatedSession = await prisma.session.update({
                    where: {
                        messageTs: session.messageTs
                    },
                    data: {
                        completed: true
                    }
                });

                await app.client.chat.postMessage({
                    thread_ts: session.messageTs,
                    channel: Environment.MAIN_CHANNEL,
                    text: t(`complete`, {
                        slackId: slackUser.slackId,
                    })
                });

                await updateController(updatedSession);         

                await prisma.user.update({
                    where: {
                        id: session.userId
                    },
                    data: {
                        lifetimeMinutes: {
                            increment: session.time
                        },
                    }
                });

                await app.client.reactions.add({
                    name: "tada",
                    channel: Environment.MAIN_CHANNEL,
                    timestamp: session.messageTs
                });

                console.log(`🏁 Session ${session.messageTs} completed by ${session.userId}`);

                continue;
            }
            else if ((session.time - session.elapsed) % 15 == 0 && session.elapsed > 0) {
                // Send a reminder every 15 minutes
                await app.client.chat.postMessage({
                    thread_ts: session.messageTs,
                    channel: Environment.MAIN_CHANNEL,
                    text: t(`update`, {
                        slackId: slackUser.slackId,
                        minutes: session.time - session.elapsed
                    })
                });
            }

            await prisma.session.update({
                where: {
                    messageTs: session.messageTs
                },
                data: {
                    elapsed: {
                        increment: 1
                    }
                }
            });

            await updateController(session);
        }
    } catch (error) {
        handle(error);
    }
});