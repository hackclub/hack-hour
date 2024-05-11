import { app } from "../lib/bolt.js";
import { Environment } from "../lib/constants.js";
import { prisma, uid } from "../lib/prisma.js";
import { minuteInterval } from "../lib/interval.js";

import { GenericMessageEvent } from "@slack/bolt";

app.message(async ({ message, say }) => {
    try {
        let sentMessage: GenericMessageEvent;

        console.log(message);

        if (message.type != 'message' ||
            message.subtype ||
            message.channel != Environment.MAIN_CHANNEL) {
            return;
        } else {
            sentMessage = message as GenericMessageEvent;
        }
    
        if (sentMessage.thread_ts) {
            return;
        }

        const slackId = sentMessage.user;

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
                                apiKey: uid()
                            }
                        },
                        tz_offset: slackUserData.user.tz_offset
                    }
                }
            );        
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
            channel: Environment.MAIN_CHANNEL,
            thread_ts: sentMessage.ts,
            text: 'Your hour starts now!',
        })

        if (!controller || !controller.ts) {
            throw new Error(`Failed to create a message for ${slackId}`)
        }

        await prisma.session.create({
            data: {
                userId: user.id,
                messageTs: sentMessage.ts,
                controlTs: controller.ts,
                
                createdAt: new Date(),
                time: 60,
                elapsed: 0,
              
                completed: false,
                cancelled : false,
                paused: false
            }
        });
    } catch (error) {
        console.error(error);

        await app.client.chat.postMessage({
            channel: process.env.LOG_CHANNEL || 'C0P5NE354',
            text: `<!subteam^${process.env.DEV_USERGROUP}> I summon thee for the following reason: \`Hack Hour crashed!\`\n*Error:*\n\`\`\`${error}\`\`\``,
        });
    }
});

minuteInterval.attach(async () => {
    try {
        const sessions = await prisma.session.findMany({
            where: {
                completed: false,
                cancelled: false,
                paused: false
            }
        });

        console.log(`🕒 Updating ${sessions.length} sessions`);

        for (const session of sessions) {
            session.elapsed += 1;

            // Check if the message exists
            const message = await app.client.conversations.history({
                channel: Environment.MAIN_CHANNEL,
                latest: session.messageTs,
                limit: 1
            });

            if (message.messages == undefined || message.messages.length == 0) {
                console.log(`❌ Session ${session.messageTs} does not exist`);
                continue;
            }

            const controllerTs = session.controlTs;

            if (session.elapsed >= session.time) { // TODO: Commit hours to goal, verify hours with events                
                await prisma.session.update({
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
                    text: `completed` /*format(randomChoice(Templates.completed), {
                        userId: session.userId
                    })*/
                });

                await prisma.user.update({
                    where: {
                        id: session.userId
                    },
                    data: {
                        lifetimeMinutes: {
                            increment: session.time
                        }
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
            else if (session.elapsed % 15 == 0) {
                // Send a reminder every 15 minutes
                await app.client.chat.postMessage({
                    thread_ts: session.messageTs,
                    channel: Environment.MAIN_CHANNEL,
                    text: `Time remaining: \`${session.time - session.elapsed}\` minutes` /*format(randomChoice(Templates.sessionReminder), {
                        userId: session.userId,
                        minutes: String(session.time - session.elapsed)
                    })*/
                });
            }

            await prisma.session.update({
                where: {
                    messageTs: session.messageTs
                },
                data: {
                    elapsed: session.elapsed
                }
            });
 
            await app.client.chat.update({
                ts: controllerTs,
                channel: Environment.MAIN_CHANNEL,
                text: `Your hour has started! Time elapsed: \`${session.time - session.elapsed}\` minutes`
            });
        }
    } catch (error) {
        
    }
})