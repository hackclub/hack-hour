import { app } from "../lib/bolt.js";
import { Environment, Actions, Commands } from "../lib/constants.js";
import { prisma, uid } from "../lib/prisma.js";
import { minuteInterval } from "../lib/interval.js";
import { t } from "../lib/templates.js";
import { handle } from "../lib/errors.js";

import { Controller } from "../views/controller.js";
import { Prisma } from "@prisma/client";

// Get the type of the session model
type Session = Prisma.SessionGetPayload<{}>;

async function fetchSlackId(userId: string) {
    const slackUser = await prisma.slackUser.findFirst({
        where: {
            user: {
                id: userId
            }
        }
    });

    if (!slackUser) {
        throw new Error(`Could not find slack user for ${userId}`);
    }

    return slackUser.slackId;
}

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

        await app.client.chat.update({
            ts: controller.ts,
            channel: Environment.MAIN_CHANNEL,
            blocks: await Controller.panel(session),
            text: "todo: replace with accessibility friendly text" // TODO: Replace with accessibility friendly text
        });
    } catch (error) {
        handle(error);
    }
});

/*
Pause Management
*/

async function pauseUpdate(session: Session) {
    // If resuming the session, reset the elapsed time since pause
    const updatedSession = await prisma.session.update({
        where: {
            messageTs: session.messageTs
        },
        data: {
            paused: !session.paused,
            elapsedSincePause: session.paused ? 0 : session.elapsedSincePause
        }
    });

    await app.client.chat.update({
        ts: session.controlTs,
        channel: Environment.MAIN_CHANNEL,
        blocks: await Controller.panel(updatedSession),
        text: "todo: replace with accessibility friendly text" // TODO: Replace with accessibility friendly text
    });

    return updatedSession;
}

app.action(Actions.PAUSE, async ({ ack, body }) => {
    try {
        const slackId = body.user.id;

        await ack();

        const session = await prisma.session.findFirst({
            where: {
                messageTs: (body as any).message.thread_ts,
                completed: false,
                cancelled: false,
                paused: false
            }
        });

        if (!session) {
            throw new Error(`Session not found for ${slackId}`);
        }

        const slackOwnerId = await fetchSlackId(session.userId);

        if (slackId !== slackOwnerId) {
            // Send an ephemeral message to the actor
            await app.client.chat.postEphemeral({
                user: slackId,
                channel: Environment.MAIN_CHANNEL,
                text: `You cannot pause another user's session!`,
                thread_ts: (body as any).message.thread_ts
            });                

            return;
        }

        await pauseUpdate(session);
    } catch (error) {
        handle(error);
    }
});

app.action(Actions.RESUME, async ({ ack, body }) => {
    try {
        const slackId = body.user.id;

        await ack();

        const session = await prisma.session.findFirst({
            where: {
                messageTs: (body as any).message.thread_ts,
                completed: false,
                cancelled: false,
                paused: true
            }
        });

        if (!session) {
            throw new Error(`Session not found for ${slackId}`);
        }

        const slackOwnerId = await fetchSlackId(session.userId);

        if (slackId !== slackOwnerId) {
            // Send an ephemeral message to the actor
            await app.client.chat.postEphemeral({
                user: slackId,
                channel: Environment.MAIN_CHANNEL,
                text: `You cannot resume another user's session!`,
                thread_ts: (body as any).message.thread_ts
            });                

            return;
        }

        await pauseUpdate(session);
    } catch (error) {
        handle(error);
    }
});

// Can toggle
app.command(Commands.PAUSE, async ({ ack, body }) => {
    try {
        await ack();

        const slackId = body.user_id;

        const session = await prisma.session.findFirst({
            where: {
                user: {
                    slackUser: {
                        slackId
                    }
                },
                completed: false,
                cancelled: false,
            }
        });

        if (!session) {
            return;
        }

        const updatedSession = await pauseUpdate(session);

        const toggleMessage = updatedSession.paused ?
            `Session paused! Run \`/pause\` again or \`/start\` to resume. You still have ${updatedSession.time - updatedSession.elapsed} minutes left.` :
            `Resumed! You have ${updatedSession.time - updatedSession.elapsed} minutes left. Run \`/pause\` again to pause.`;

        // Send a message to the user in the channel they ran the command
        const result = await app.client.chat.postEphemeral({
            user: slackId,
            channel: body.channel_id,
            text: /*t(`pause`, {
                paused: updatedSession.paused
            })*/ toggleMessage
        });

        if (!result.ok) {
            // If the error is due to access permissions, just send a message to the thread
            if (result.error === 'not_in_channel') { 
                await app.client.chat.postMessage({
                    channel: body.channel_id,
                    thread_ts: body.message_ts,
                    text: toggleMessage
                });
            } else {
                throw new Error(`Error sending message: ${result.error}`);
            }
        }
    } catch (error) {
        handle(error);
    }
});

// Can only start
app.command(Commands.START, async ({ ack, body }) => {
    try {
        await ack();

        const slackId = body.user_id;

        const session = await prisma.session.findFirst({
            where: {
                user: {
                    slackUser: {
                        slackId
                    }
                },
                completed: false,
                cancelled: false,
            }
        });

        if (!session) {
            return;
        }

        if (!session.paused) {
            const result = await app.client.chat.postEphemeral({
                user: slackId,
                channel: body.channel_id,
                text: `Session is already running! Run \`/pause\` to pause.`
            });

            if (!result.ok) {
                // If the error is due to access permissions, just dm the user
                if (result.error === 'not_in_channel') { 
                    await app.client.chat.postMessage({
                        channel: slackId,
                        thread_ts: body.message_ts,
                        text: `Session is already running! Run \`/pause\` to pause.`
                    });
                } else {
                    throw new Error(`Error sending message: ${result.error}`);
                }
            }
        }

        const updatedSession = await pauseUpdate(session);

        // Send a message to the user in the channel they ran the command
        const result = await app.client.chat.postEphemeral({
            user: slackId,
            channel: body.channel_id,
            text: `Session resumed! You have ${updatedSession.time - updatedSession.elapsed} minutes left. Run \`/pause\` to pause.`
        });

        if (!result.ok) {
            // If the error is due to access permissions, just send a message to the thread
            if (result.error === 'not_in_channel') { 
                await app.client.chat.postMessage({
                    channel: body.channel_id,
                    thread_ts: body.message_ts,
                    text: `Session resumed! You have ${updatedSession.time - updatedSession.elapsed} minutes left. Run \`/pause\` to pause.`
                });
            } else {
                throw new Error(`Error sending message: ${result.error}`);
            }
        }
    } catch (error) {
        handle(error);
    }
});

/*
Cancellation
*/
async function cancelSession(slackId: string, session: Session) {
    const updatedSession = await prisma.session.update({
        where: {
            messageTs: session.messageTs
        },
        data: {
            cancelled: true
        }
    });
    
    await app.client.chat.postMessage({
        thread_ts: updatedSession.messageTs,
        channel: Environment.MAIN_CHANNEL,
        text: t(`cancel`, {
            slackId
        })
    });

    await app.client.chat.update({
        ts: updatedSession.controlTs,
        channel: Environment.MAIN_CHANNEL,
        blocks: await Controller.panel(updatedSession),
        text: "todo: replace with accessibility friendly text" // TODO: Replace with accessibility friendly text
    });
}

app.action(Actions.CANCEL, async ({ ack, body }) => {
    try {
        await ack();

        const slackId = body.user.id;

        const session = await prisma.session.findFirst({
            where: {
                messageTs: (body as any).message.thread_ts,
                completed: false,
                cancelled: false,
            }
        });

        if (!session) {
            throw new Error(`Session not found for ${slackId}`);
        }
        
        if (slackId !== await fetchSlackId(session.userId)) {
            // Send an ephemeral message to the actor
            await app.client.chat.postEphemeral({
                user: slackId,
                channel: Environment.MAIN_CHANNEL,
                text: `You cannot cancel another user's session!`,
                thread_ts: (body as any).message.thread_ts
            });                

            return;
        }

        await cancelSession(slackId, session);
    } catch (error) {
        handle(error);
    }
});
                
app.command(Commands.CANCEL, async ({ ack, body }) => {
    try {
        await ack();

        const slackId = body.user_id;

        const session = await prisma.session.findFirst({
            where: {
                user: {
                    slackUser: {
                        slackId
                    }
                },
                completed: false,
                cancelled: false,
            }
        });

        if (!session) {
            // Send a message to the user in the channel they ran the command
            return;
        }

        await cancelSession(slackId, session);
    } catch (error) {
        handle(error);
    }    
});

/*
Time Extension
*/
app.action(Actions.EXTEND, async ({ ack, body }) => {

});

app.command(Commands.EXTEND, async ({ ack, body }) => {
    try {
        await ack();

        const session = await prisma.session.findFirst({
            where: {
                user: {
                    slackUser: {
                        slackId: body.user_id
                    }
                },
                completed: false,
                cancelled: false,
            }
        });

        if (!session) {
            // Send a message to the user in the channel they ran the command
        }

        await app.client.views.open({
            trigger_id: body.trigger_id,
            view: Controller.extendHourModal()
        })
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

                await app.client.chat.update({
                    ts: controllerTs,
                    channel: Environment.MAIN_CHANNEL,
                    blocks: await Controller.panel(session),
                    text: "todo: replace with accessibility friendly text" // TODO: Replace with accessibility friendly text
                });                
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

                await app.client.chat.update({
                    ts: controllerTs,
                    channel: Environment.MAIN_CHANNEL,
                    blocks: await Controller.panel(updatedSession),
                    text: "todo: replace with accessibility friendly text", // TODO: Replace with accessibility friendly text
                });                

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

            await app.client.chat.update({
                ts: controllerTs,
                channel: Environment.MAIN_CHANNEL,
                blocks: await Controller.panel(session),
                text: "todo: replace with accessibility friendly text" // TODO: Replace with accessibility friendly text
            });
        }
    } catch (error) {
        handle(error);
    }
});