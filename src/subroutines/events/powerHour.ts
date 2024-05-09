import { Session } from '@prisma/client';
import { app, prisma } from '../../app.js';
import { Environment } from "../../constants.js";
import { formatHour } from "../../utils/string.js";
import { BasePicnic } from './basePicnic.js';
import { Picnics } from './picnics.js';
import { assertVal } from '../../utils/lib.js';
import { error } from 'console';

// This is the main file for the powerhour event.

const POWERHOUR_ID = "powerhour";

class PowerHour implements BasePicnic {
    NAME = "*Power Hour*";
    DESCRIPTION = "every hour more power! Apr27-May4";
    ID = POWERHOUR_ID;

    START_TIME = new Date("2024-04-27T06:00:00-0500");
    END_TIME = new Date("2024-05-04T23:59:00-0500");

    CUSTOM_NAME = "powerhour.exe";
    CUSTOM_EMOJI = ":hourglass_flowing_sand:";

    COMMUNITY_GOAL = 100 * 60; // Minutes - 100 hours * 60m/h

    private isEventActive(): boolean {
        const currentTime = new Date();

//        return currentTime >= this.START_TIME && currentTime < this.END_TIME;
        return true; // just for testing
    }

    private async isRegistered(userId: string): Promise<boolean> {
        const user = await prisma.user.findFirst({
            where: {
                slackId: userId,
                eventId: this.ID,
            },
        });
 
        const event = await prisma.eventContributions.findFirst({
            where: {
                slackId: userId,
                eventId: this.ID,
            },
        });

        return user != null && user.eventId == this.ID && event != null;
    }

    constructor() {
        app.client.chat.postMessage({
            channel: Environment.POWERHOUR_ORG,
            text: "PowerHour Event Initialized",
        });

        app.event("reaction_added", async ({ event, client }) => {
            if (!(event.reaction === "white_check_mark")) {
                return;
            }

            if (!this.isEventActive()) {
                return;
            }

            const forwardTs = event.item.ts;

            // Get the message that was forwarded
            const messageResult = (await client.conversations.history({
                channel: Environment.POWERHOUR_ORG,
                latest: forwardTs,
                inclusive: true,
                limit: 1,                
            })).messages;

            let userId = "";
            try {
                if (!messageResult || messageResult.length == 0) { throw new Error("Forwarded message not found"); }

                assertVal(messageResult[0]);
                console.log(messageResult[0]);

                const metadata = messageResult[0].metadata;
                if (!metadata) {
                    // it appears that the message is not a confirmation message
                    return;
                }

                assertVal(metadata.event_type);
  
                userId = metadata.event_type;
            } catch (error) {
                console.error(error);
                return;
            }            

            const eventEntry = await prisma.eventContributions.findFirst({
                where: {
                    slackId: userId,
                    eventId: this.ID,
                },
            });

            if (!eventEntry) {
                throw new Error("User not found in database");
            }

            const eventSessions = JSON.parse(eventEntry.sessions);
            const sessionID = eventSessions[forwardTs];

            if (!sessionID) {
                // The session has already been verfied likely
                console.log("Sesh likely already verified");
                return;
            }

            const session = await prisma.session.findUnique({
                where: {
                    messageTs: sessionID,
                },
            });
    
            const elapsedTime = session?.elapsed;

            if (!elapsedTime) {
                throw new Error("Session not found in database");
            }

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

            await client.reactions.add({
                channel: Environment.MAIN_CHANNEL,
                name: "white_check_mark",
                timestamp: eventSessions[forwardTs],
            });

            delete eventSessions[forwardTs];              

            await prisma.eventContributions.update({
                where: {
                    contributionId: eventEntry.contributionId,
                },
                data: {
                    minutes: {
                        increment: elapsedTime + 1,
                    },
                    sessions: JSON.stringify(eventSessions),
                },
            });            

            console.log(`✅ User <@${userId}>'s session was verified! They contributed ${elapsedTime} minutes to the event.`);
        });

        app.command("/_admin_pwrhr_check", async ({ ack, body }) => {
            // Make sure the user is an admin
            if (body.user_id != 'U04QD71QWS0') {
                await ack("looks like you found something secret. here's a cookie 🍪")
                return;
            }

            const rawCell = `U04AQNZRJQ5
U06V2EMR9U2
U054VC2KM9P
U05F4B48GBF
U015SDXHEPR
U040N4ESCEL
U04N415FE4T
U05A3TSL7UY
UO5SCJJHUF7
U04FMKCVASJ
U06MCHA590E
U06U13RSLH2
U05APP82JMR
U06NNELQ4SZ
U06MWAFGYCX`;

            await ack();
            await this.hourlyCheck();
        });
    }

    async createSession(slackId: string, messageTs: string): Promise<void> {
        if (!this.isEventActive()) {
            return;
        }

        if (!await this.isRegistered(slackId)) {
            return;
        }

        console.log("🚀  PowerHour Session Created");

        await app.client.chat.postMessage({
            channel: Environment.MAIN_CHANNEL,
            thread_ts: messageTs,
            text: "Make sure to provide us updates & show us your progress!!!",
            icon_emoji: this.CUSTOM_EMOJI,
            username: this.CUSTOM_NAME,
        });        
    }

    async endSession(session: Session): Promise<void> {
        if (!this.isEventActive()) {
            return;
        }

        if (!await this.isRegistered(session.userId)) {
            return;
        }

        await app.client.chat.postMessage({
            channel: Environment.MAIN_CHANNEL,
            thread_ts: session.messageTs,
            text: "Congrats for finishing this PowerHour session! Put down some reflections from your session or share your current progress.",
            icon_emoji: this.CUSTOM_EMOJI,
            username: this.CUSTOM_NAME,
        });

        const permalink = (await app.client.chat.getPermalink({
            channel: Environment.MAIN_CHANNEL,
            message_ts: session.messageTs,
        })).permalink;

        const forwardTs = await app.client.chat.postMessage({
            channel: Environment.POWERHOUR_ORG,
            text: `*User <@${session.userId}>'s session ended!* React with :white_check_mark: to verify the session.\n\n${permalink}`,
            metadata: {
                event_type: session.userId,
                event_payload: {
                    slackUserRef: session.userId,
                }   
            }
        });

        const eventEntry = await prisma.eventContributions.findFirst({
            where: {
                slackId: session.userId,
                eventId: this.ID,
            },
        });

        if (!forwardTs.ts) {
            throw new Error("Forward message failed to send");
        }

        if (!eventEntry) {
            throw new Error("User not found in database");
        }

        const sessions = JSON.parse(eventEntry.sessions);

        sessions[forwardTs.ts] = session.messageTs;

        await prisma.eventContributions.update({
            where: {
                contributionId: eventEntry.contributionId,
            },
            data: {
                sessions: JSON.stringify(sessions),
            },
        });
    }

    async cancelSession(session: Session): Promise<void> {
        if (!this.isEventActive()) {
            return;
        }

        if (!await this.isRegistered(session.userId)) {
            return;
        }

        await app.client.chat.postMessage({
            channel: Environment.MAIN_CHANNEL,
            thread_ts: session.messageTs,
            text: "While this session was cancelled, you should still put down some reflections from your session or share your current progress.",
            icon_emoji: this.CUSTOM_EMOJI,
            username: this.CUSTOM_NAME,
        });

        const permalink = (await app.client.chat.getPermalink({
            channel: Environment.MAIN_CHANNEL,
            message_ts: session.messageTs,
        })).permalink;

        const forwardTs = await app.client.chat.postMessage({
            channel: Environment.POWERHOUR_ORG,
            text: `*User <@${session.userId}> cancelled their session.* However, they can still contribute to the event. React with :white_check_mark: to verify the session.\n\nLink to thread: ${permalink}`,
            metadata: {
                event_type: session.userId,
                event_payload: {
                    slackUserRef: session.userId,
                }
            }
        });

        const eventEntry = await prisma.eventContributions.findFirst({
            where: {
                slackId: session.userId,
                eventId: this.ID,
            },
        });

        if (!forwardTs.ts) {
            throw new Error("Forward message failed to send");
        }

        if (!eventEntry) {
            throw new Error("User not found in database");
        }

        const sessions = JSON.parse(eventEntry.sessions);

        sessions[forwardTs.ts] = session.messageTs;

        await prisma.eventContributions.update({
            where: {
                contributionId: eventEntry.contributionId,
            },
            data: {
                sessions: JSON.stringify(sessions),
            },

        });
    }

    async hourlyCheck(): Promise<void> {
        const currentTime = new Date();

        const eventContributions = await prisma.eventContributions.findMany({
            where: {
                eventId: this.ID,
            },
        });

        const users = await prisma.user.findMany({
            where: {
                eventId: this.ID,
            },
        });

        let totalMinutes = 0;
        let completion = 0;
        for (const contribution of eventContributions) {
            totalMinutes += contribution.minutes;

            if (contribution.minutes >= (7*59)) {
                completion += 1;
            }
        }
        
        // Check if it's the final hour and same day
        if (currentTime.getDate() == this.END_TIME.getDate() &&
            currentTime.getMonth() == this.END_TIME.getMonth() &&
            currentTime.getHours() == this.END_TIME.getHours()) {

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

            /*
            for (const user of users) {
                await prisma.user.update({
                    where: {
                        slackId: user.slackId,
                        eventId: this.ID,
                    },
                    data: {
                        eventId: "none",
                    },
                });
            } // leave this to be done manually        
            */

            console.log("🎉  PowerHour Event Complete");                
        }

        if (!this.isEventActive()) {
            return;
        }

        await app.client.chat.postMessage({
            channel: Environment.POWERHOUR_ORG,
            text: `*Hourly Updates:*\n\n*Total hours contributed*: ${formatHour(totalMinutes)}\n*Progress*: ${Math.round((totalMinutes / this.COMMUNITY_GOAL) * 100)}%`,
        });

        await app.client.conversations.setTopic({
            channel: Environment.MAIN_CHANNEL,
            topic: `\`/hack\` to start. | Total hours contributed: ${formatHour(totalMinutes)} | Completion: ${completion}/${eventContributions.length} reached the 7 hour goal - ${Math.round((completion / eventContributions.length) * 100)}%`,
            //Progress: ${Math.round((totalMinutes / this.COMMUNITY_GOAL) * 100)}%`,
            // *We do an hour a day, because it keeps the doctor away.* 
        });

        console.log("🪅  Hourly Check Complete");
    }
    
    async userJoin(userId: string): Promise<{ ok: boolean, message: string }> {
        // Check if the event is still active
        const currentTime = new Date();

        if (currentTime >= this.END_TIME) {
            return {
                ok: false,
                message: "The event has already ended."
            };
        }

        /*
        if (currentTime < this.START_TIME) {
            return {
                ok: false,
                message: "The event has not started yet."
            };
        }
        */
        
        // Check if the user is already in the database, if not add them
        const eventEntry = await this.isRegistered(userId);
 
        if (eventEntry) {
            return {
                ok: false,
                message: "Already registered!"
            };
        }

        await prisma.eventContributions.create({
            data: {
                slackId: userId,
                eventId: this.ID,
                minutes: 0,
                sessions: JSON.stringify({
                    // forwardTs: sessionID
                }),
            },
        });

        await prisma.user.update({
            where: {
                slackId: userId,
            },
            data: {
                eventId: this.ID,
            },
        });

        return {
            ok: true,
            message: ""
        };
    }
}

Picnics.push(new PowerHour());