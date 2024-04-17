// This is the main file for the powerhour event.

import { PrismaClient, Prisma } from "@prisma/client";
import { App } from "@slack/bolt";
import { StringIndexed } from "@slack/bolt/dist/types/helpers.js";
import { BaseEvent, Session } from "./baseEvent.js";
import { Constants } from "../constants.js";
import { formatHour } from "../lib.js";

if (process.env.POWERHOUR_ORG == undefined) { throw new Error("PowerHour organizer channel isn't defined!") }

const POWERHOUR_ORGANIZERS_CHANNEL = process.env.POWERHOUR_ORG;

export const POWERHOUR_ID = "powerhour";

const POWERHOUR_USERS = [
    "U04QD71QWS0"
];

const COMMUNITY_GOAL = 105 * 60; // Minutes - 7 hours * 15 people

const START_TIME = new Date("2024-04-18T01:12:00-0500");
const END_TIME = new Date("2024-04-18T02:10:00-0500");
        
export class PowerHour implements BaseEvent {
    app: App<StringIndexed>;
    prisma: PrismaClient;

    name = "*TEACH Initative 2025*";
    description = "_We're just kidding - this is the beta test for the upcoming hack hour event._";
    id = POWERHOUR_ID;

    constructor(app: App, prisma: PrismaClient) {
        this.app = app;
        this.prisma = prisma;

        app.client.chat.postMessage({
            channel: Constants.HACK_HOUR_CHANNEL,
            blocks: [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "This is a mrkdwn section block :ghost: *this is bold*, and ~this is crossed out~, and https://hackclub.slack.com/files/U04QD71QWS0/F06UX1KBZKJ/659e6c1875a6ef6d59572be3_types_of_landscapes.webp"
                        }
                    }
                ],
            unfurl_links: true,
            unfurl_media: true,
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
                    channel: POWERHOUR_ORGANIZERS_CHANNEL,
                    latest: forwardTs,
                    inclusive: true,
                    limit: 1,
                    include_all_metadata: true,
                })).messages;

                if (!messageResult) { return;}
                if (messageResult.length == 0) { return; }
                if (!messageResult[0]) { return; }
                if (!messageResult[0].metadata) { return; }
                if (!messageResult[0].metadata.event_payload) { return; }
                
                const userId: string = (messageResult[0].metadata.event_payload as any).slackUserRef;

                const eventEntry = await this.prisma.eventContributions.findFirst({
                    where: {
                        slackId: userId,
                        eventId: POWERHOUR_ID,
                    },
                });

                if (eventEntry == null) {
                    await client.chat.postMessage({
                        channel: POWERHOUR_ORGANIZERS_CHANNEL,
                        text: `There was an error with the database. User <@${userId}> was not found in the database. Check thread ${forwardTs} manually.`,
                    });
                    return;
                }

                const eventSessions = JSON.parse(eventEntry.sessions);
                const sessionID = eventSessions.unverifiedSessions[forwardTs];
                delete eventSessions.unverifiedSessions[forwardTs];

                const session = await this.prisma.session.findUnique({
                    where: {
                        messageTs: sessionID,
                    },
                });
                const elapsedTime = session?.elapsed;

                await this.prisma.eventContributions.update({
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
                    channel: POWERHOUR_ORGANIZERS_CHANNEL,
                    text: `User <@${userId}>'s session was verified! They contributed ${elapsedTime} minutes to the event.`,
                    thread_ts: forwardTs,
                });

                await client.reactions.add({
                    channel: POWERHOUR_ORGANIZERS_CHANNEL,
                    name: "tada",
                    timestamp: forwardTs,
                });

                console.log(`✅ User <@${userId}>'s session was verified! They contributed ${elapsedTime} minutes to the event.`);
            } catch (error) {
                console.error(error);
                await this.app.client.chat.postMessage({
                    channel: POWERHOUR_ORGANIZERS_CHANNEL,
                    text: `*There was an error.* You'll need to verify the thread with timestamp ${event.item.ts} manually.\n\`\`\`${error}\`\`\``,
                });
            }
        });
    }

    async endSession(session: Session): Promise<void> {
        await this.app.client.chat.postMessage({
            channel: Constants.HACK_HOUR_CHANNEL,
            thread_ts: session.messageTs,
            text: "Congrats for finishing this PowerHour session! Put down some reflections from your session or share your current progress.",
        });

        const permalink = (await this.app.client.chat.getPermalink({
            channel: Constants.HACK_HOUR_CHANNEL,
            message_ts: session.messageTs,
        })).permalink;

        const forwardTs = await this.app.client.chat.postMessage({
            channel: POWERHOUR_ORGANIZERS_CHANNEL,
            text: `*User <@${session.userId}>'s session ended!* React with :white_check_mark: to verify the session.\n\n${permalink}`,
            metadata: {
                event_type: "end",
                event_payload: {
                    slackUserRef: session.userId,
                }
            }
        });

        if (!forwardTs.ts) {
            await this.app.client.chat.postMessage({
                channel: POWERHOUR_ORGANIZERS_CHANNEL,
                text: `There was an error forwarding. Check logs.`,
            });
            throw new Error("Forward message failed to send");
        }

        const eventEntry = await this.prisma.eventContributions.findFirst({
            where: {
                slackId: session.userId,
                eventId: POWERHOUR_ID,
            },
        });

        if (eventEntry == null) {
            await this.app.client.chat.postMessage({
                channel: POWERHOUR_ORGANIZERS_CHANNEL,
                text: `There was an error with the database. User <@${session.userId}> was not found in the database. Check thread ${permalink} manually.`,
            });
        } else {
            const sessions = JSON.parse(eventEntry.sessions);

            sessions.unverifiedSessions[forwardTs.ts] = session.messageTs;

            await this.prisma.eventContributions.update({
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
        await this.app.client.chat.postMessage({
            channel: Constants.HACK_HOUR_CHANNEL,
            thread_ts: session.messageTs,
            text: "While this session was cancelled, you should still put down some reflections from your session or share your current progress.",
        });

        const permalink = (await this.app.client.chat.getPermalink({
            channel: Constants.HACK_HOUR_CHANNEL,
            message_ts: session.messageTs,
        })).permalink;

        const forwardTs = await this.app.client.chat.postMessage({
            channel: POWERHOUR_ORGANIZERS_CHANNEL,
            text: `*User <@${session.userId}> cancelled their session.* However, they can still contribute to the event. React with :white_check_mark: to verify the session.\n\nLink to thread: ${permalink}`,
        });

        const eventEntry = await this.prisma.eventContributions.findFirst({
            where: {
                slackId: session.userId,
                eventId: POWERHOUR_ID,
            },
        });

        if (!forwardTs.ts) {
            throw new Error("Forward message failed to send");
        }

        if (eventEntry == null) {
            await this.app.client.chat.postMessage({
                channel: POWERHOUR_ORGANIZERS_CHANNEL,
                text: `There was an error with the database. User <@${session.userId}> was not found in the database. Check thread ${permalink} manually.`,
            });
        } else {
            const sessions = JSON.parse(eventEntry.sessions);

            sessions.unverifiedSessions[forwardTs.ts] = session.messageTs;

            await this.prisma.eventContributions.update({
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
        if (currentTime < START_TIME) {
            console.log(" ⏳ PowerHour Event Not Started");
            return;
        }        

        const eventContributions = await this.prisma.eventContributions.findMany({
            where: {
                eventId: POWERHOUR_ID,
            },
        });

        const users = await this.prisma.user.findMany({
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

        if (currentTime >= END_TIME) {
            // Check if the community goal was met
            if (totalMinutes >= COMMUNITY_GOAL) {
                await this.app.client.chat.postMessage({
                    channel: POWERHOUR_ORGANIZERS_CHANNEL,
                    text: `The community goal of ${COMMUNITY_GOAL} minutes was met!`,
                });
            } else {
                await this.app.client.chat.postMessage({
                    channel: POWERHOUR_ORGANIZERS_CHANNEL,
                    text: `The community goal of ${COMMUNITY_GOAL} minutes was not met. 😢`,
                });
            }

            for (const user of users) {
                await this.prisma.user.update({
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
            await this.app.client.chat.postMessage({
                channel: POWERHOUR_ORGANIZERS_CHANNEL,
                text: `*Hourly Updates:*\n\n*Total hours contributed*: ${formatHour(totalMinutes)}\n*Progress*: ${Math.round((totalMinutes / COMMUNITY_GOAL) * 100)}%`,
            });
    
            await this.app.client.conversations.setTopic({
                channel: Constants.HACK_HOUR_CHANNEL,
                topic: `*We do an hour a day, because it keeps the doctor away.* \`/hack\` to start. | Total hours contributed: ${formatHour(totalMinutes)} | Progress: ${Math.round((totalMinutes / COMMUNITY_GOAL) * 100)}%`,
            });            
        }
 
        console.log("🪅  Hourly Check Complete");
    }

    async userJoin(userId: string): Promise<boolean> {
        // Check if the event is still active
        const currentTime = new Date();

        if (currentTime >= END_TIME) {
            return false;
        } else if (currentTime < START_TIME) {
            return false;
        }
 
        if (POWERHOUR_USERS.includes(userId)) {
            // Check if the user is already in the database, if not add them
            const eventEntry = await this.prisma.eventContributions.findFirst({
                where: {
                    slackId: userId,
                    eventId: POWERHOUR_ID,
                },
            });

            if (!eventEntry) {
                await this.prisma.eventContributions.create({
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
        return false;
    }
}