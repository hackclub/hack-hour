import { Session } from '@prisma/client';
import { app, prisma } from '../../app.js';
import { Environment } from "../../constants.js";
import { formatHour } from "../../utils/string.js";
import { BasePicnic } from './basePicnic.js';
import { Picnics } from './picnics.js';

// This is the main file for the powerhour event.

const POWERHOUR_ID = "powerhour";

class PowerHour implements BasePicnic {
    NAME = "*TEACH Initative 2025*";
    DESCRIPTION = "_We're just kidding - this is the beta test for the upcoming hack hour event._";
    ID = POWERHOUR_ID;

    START_TIME = new Date("2024-04-18T01:12:00-0500");
    END_TIME = new Date("2024-04-18T02:10:00-0500");

    COMMUNITY_GOAL = 105 * 60; // Minutes - 7 hours * 15 people

    constructor() {
        app.client.chat.postMessage({
            channel: Environment.POWERHOUR_ORG,
            text: "PowerHour Event Initialized",
        });

        app.event("reaction_added", async ({ event, client }) => {
            try {
                // Check if the reaction is a checkmark
                if (!(event.reaction === "white_check_mark")) {
                    return;
                }

                const forwardTs = event.item.ts;

                // Get the message that was forwarded
                const messageResult = (await client.conversations.history({
                    channel: Environment.POWERHOUR_ORG,
                    latest: forwardTs,
                    inclusive: true,
                    limit: 1,
                    include_all_metadata: true,
                })).messages;

                if (!messageResult) { return; }
                if (messageResult.length == 0) { return; }
                if (!messageResult[0]) { return; }
                if (!messageResult[0].metadata) { return; }
                if (!messageResult[0].metadata.event_payload) { return; }

                const userId: string = (messageResult[0].metadata.event_payload as any).slackUserRef;

                const eventEntry = await prisma.eventContributions.findFirst({
                    where: {
                        slackId: userId,
                        eventId: POWERHOUR_ID,
                    },
                });

                if (eventEntry == null) {
                    await client.chat.postMessage({
                        channel: Environment.POWERHOUR_ORG,
                        text: `There was an error with the database. User <@${userId}> was not found in the database. Check thread ${forwardTs} manually.`,
                    });
                    return;
                }

                const eventSessions = JSON.parse(eventEntry.sessions);
                const sessionID = eventSessions.unverifiedSessions[forwardTs];
                delete eventSessions.unverifiedSessions[forwardTs];

                const session = await prisma.session.findUnique({
                    where: {
                        messageTs: sessionID,
                    },
                });
                const elapsedTime = session?.elapsed;

                await prisma.eventContributions.update({
                    where: {
                        contributionId: eventEntry.contributionId,
                    },
                    data: {
                        minutes: {
                            increment: elapsedTime,
                        },
                        sessions: JSON.stringify(eventSessions),
                    },
                });

                await client.chat.postMessage({
                    channel: Environment.POWERHOUR_ORG,
                    text: `User <@${userId}>'s session was verified! They contributed ${elapsedTime} minutes to the event.`,
                    thread_ts: forwardTs,
                });

                await client.reactions.add({
                    channel: Environment.POWERHOUR_ORG,
                    name: "tada",
                    timestamp: forwardTs,
                });

                console.log(`✅ User <@${userId}>'s session was verified! They contributed ${elapsedTime} minutes to the event.`);
            } catch (error) {
                console.error(error);
                await app.client.chat.postMessage({
                    channel: Environment.POWERHOUR_ORG,
                    text: `*There was an error.* You'll need to verify the thread with timestamp ${event.item.ts} manually.\n\`\`\`${error}\`\`\``,
                });
            }
        });
    }

    async endSession(session: Session): Promise<void> {
        await app.client.chat.postMessage({
            channel: Environment.MAIN_CHANNEL,
            thread_ts: session.messageTs,
            text: "Congrats for finishing this PowerHour session! Put down some reflections from your session or share your current progress.",
        });

        const permalink = (await app.client.chat.getPermalink({
            channel: Environment.MAIN_CHANNEL,
            message_ts: session.messageTs,
        })).permalink;

        const forwardTs = await app.client.chat.postMessage({
            channel: Environment.POWERHOUR_ORG,
            text: `*User <@${session.userId}>'s session ended!* React with :white_check_mark: to verify the session.\n\n${permalink}`,
            metadata: {
                event_type: "end",
                event_payload: {
                    slackUserRef: session.userId,
                }
            }
        });

        if (!forwardTs.ts) {
            await app.client.chat.postMessage({
                channel: Environment.POWERHOUR_ORG,
                text: `There was an error forwarding. Check logs.`,
            });
            throw new Error("Forward message failed to send");
        }

        const eventEntry = await prisma.eventContributions.findFirst({
            where: {
                slackId: session.userId,
                eventId: POWERHOUR_ID,
            },
        });

        if (eventEntry == null) {
            await app.client.chat.postMessage({
                channel: Environment.POWERHOUR_ORG,
                text: `There was an error with the database. User <@${session.userId}> was not found in the database. Check thread ${permalink} manually.`,
            });
        } else {
            const sessions = JSON.parse(eventEntry.sessions);

            sessions.unverifiedSessions[forwardTs.ts] = session.messageTs;

            await prisma.eventContributions.update({
                where: {
                    contributionId: eventEntry.contributionId,
                },
                data: {
                    sessions: JSON.stringify(sessions),
                },
            });
        }
    }

    async cancelSession(session: Session): Promise<void> {
        await app.client.chat.postMessage({
            channel: Environment.MAIN_CHANNEL,
            thread_ts: session.messageTs,
            text: "While this session was cancelled, you should still put down some reflections from your session or share your current progress.",
        });

        const permalink = (await app.client.chat.getPermalink({
            channel: Environment.MAIN_CHANNEL,
            message_ts: session.messageTs,
        })).permalink;

        const forwardTs = await app.client.chat.postMessage({
            channel: Environment.POWERHOUR_ORG,
            text: `*User <@${session.userId}> cancelled their session.* However, they can still contribute to the event. React with :white_check_mark: to verify the session.\n\nLink to thread: ${permalink}`,
        });

        const eventEntry = await prisma.eventContributions.findFirst({
            where: {
                slackId: session.userId,
                eventId: POWERHOUR_ID,
            },
        });

        if (!forwardTs.ts) {
            throw new Error("Forward message failed to send");
        }

        if (eventEntry == null) {
            await app.client.chat.postMessage({
                channel: Environment.POWERHOUR_ORG,
                text: `There was an error with the database. User <@${session.userId}> was not found in the database. Check thread ${permalink} manually.`,
            });
        } else {
            const sessions = JSON.parse(eventEntry.sessions);

            sessions.unverifiedSessions[forwardTs.ts] = session.messageTs;

            await prisma.eventContributions.update({
                where: {
                    contributionId: eventEntry.contributionId,
                },
                data: {
                    sessions: JSON.stringify(sessions),
                },
            });
        }
    }

    async hourlyCheck(): Promise<void> {
        const currentTime = new Date();

        // Skip if the event has not started or has ended
        if (currentTime < this.START_TIME) {
            console.log(" ⏳ PowerHour Event Not Started");
            return;
        }

        const eventContributions = await prisma.eventContributions.findMany({
            where: {
                eventId: POWERHOUR_ID,
            },
        });

        const users = await prisma.user.findMany({
            where: {
                eventId: POWERHOUR_ID,
            },
        });

        // Check if users are zero - means that the event has ended or has not started
        if (users.length == 0) {
            console.log(" ⏳ Skipping PowerHour Event Processing - No users");
            return;
        }

        let totalMinutes = 0;
        for (const contribution of eventContributions) {
            totalMinutes += contribution.minutes;
        }

        if (currentTime >= this.END_TIME) {
            // Check if the community goal was met
            if (totalMinutes >= this.COMMUNITY_GOAL) {
                await app.client.chat.postMessage({
                    channel: Environment.POWERHOUR_ORG,
                    text: `The community goal of ${this.COMMUNITY_GOAL} minutes was met!`,
                });
            } else {
                await app.client.chat.postMessage({
                    channel: Environment.POWERHOUR_ORG,
                    text: `The community goal of ${this.COMMUNITY_GOAL} minutes was not met. 😢`,
                });
            }

            for (const user of users) {
                await prisma.user.update({
                    where: {
                        slackId: user.slackId,
                        eventId: POWERHOUR_ID,
                    },
                    data: {
                        eventId: "none",
                    },
                });
            }

            console.log("🎉  PowerHour Event Complete");
        } else {
            await app.client.chat.postMessage({
                channel: Environment.POWERHOUR_ORG,
                text: `*Hourly Updates:*\n\n*Total hours contributed*: ${formatHour(totalMinutes)}\n*Progress*: ${Math.round((totalMinutes / this.COMMUNITY_GOAL) * 100)}%`,
            });

            await app.client.conversations.setTopic({
                channel: Environment.MAIN_CHANNEL,
                topic: `*We do an hour a day, because it keeps the doctor away.* \`/hack\` to start. | Total hours contributed: ${formatHour(totalMinutes)} | Progress: ${Math.round((totalMinutes / this.COMMUNITY_GOAL) * 100)}%`,
            });
        }

        console.log("🪅  Hourly Check Complete");
    }

    async userJoin(userId: string): Promise<boolean> {
        // Check if the event is still active
        const currentTime = new Date();

        if (currentTime >= this.END_TIME) {
            return false;
        } else if (currentTime < this.START_TIME) {
            return false;
        }

        // Check if the user is already in the database, if not add them
        const eventEntry = await prisma.eventContributions.findFirst({
            where: {
                slackId: userId,
                eventId: POWERHOUR_ID,
            },
        });

        if (!eventEntry) {
            await prisma.eventContributions.create({
                data: {
                    slackId: userId,
                    eventId: POWERHOUR_ID,
                    minutes: 0,
                    sessions: JSON.stringify({
                        unverifiedSessions: {
                            // forwardTs: sessionID
                        }
                    }),
                },
            });
        }

        return true;
    }
}

Picnics.push(new PowerHour());