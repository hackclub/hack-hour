import bolt, { KnownBlock, View } from '@slack/bolt';
import { CALLBACK_ID, Views, ACTION_ID } from './views/views.js';
import { Constants, Commands } from './constants.js';
import { format, randomChoice, formatHour } from './lib.js';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Templates } from './message.js';
import { reactOnContent } from './emoji.js';
import { genEvents } from './events/events.js';
import { BaseEvent } from './events/baseEvent.js';

const { App } = bolt;
const prisma = new PrismaClient();
const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,

//  socketMode: true,
});

const events: { [keys: string]: BaseEvent } = genEvents(app, prisma);

function assertVal<T>(value: T | undefined | null): asserts value is T {
    // Throw if the value is undefined
    if (value === undefined) { throw new Error(`${value} is undefined, needs to be type ${typeof value}`) }
    else if (value === null) { throw new Error(`${value} is null, needs to be type ${typeof value}`) }
}

async function isUser(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: {
            slackId: userId
        }
    });
    return user !== null;
}

(async () => {
    /**
     * /hack
     * Entrypoint to hack hour
     */
    app.command(Commands.HACK, async ({ ack, body, client }) => {
        const text: string = body.text;
        const userId: string = body.user_id;

        await ack();

        const userData = await prisma.user.findUnique({
            where: {
                slackId: userId
            }
        });

        if (!userData) {
            await client.views.open({
                trigger_id: body.trigger_id,
                view: Views.WELCOME
            });
            return;
        }

        const session = await prisma.session.findFirst({
            where: {
                userId: userId,
                completed: false,
                cancelled: false
            }
        });

        if (session) {
            await client.chat.postEphemeral({
                channel: Constants.HACK_HOUR_CHANNEL,
                text: `🚨 You're already in a session! Finish that one before starting a new one.`,
                user: userId
            });
            return;
        }

        // Check if there's text - if there is use shorthand mode
        if (text) {
            const formatText = `> ${text}`;

            const template = randomChoice(Templates.minutesRemaining);

            const message = await client.chat.postMessage({
                channel: Constants.HACK_HOUR_CHANNEL,
                text: format(template, {
                    userId: userId,
                    minutes: "60",
                    task: formatText
                })
            });

            assertVal(message.ts);

            reactOnContent(app, {
                content: text,
                channel: Constants.HACK_HOUR_CHANNEL,
                ts: message.ts
            });

            await prisma.session.create({
                data: {
                    messageTs: message.ts,
                    template: template,
                    userId: userId,
                    goal: userData.defaultGoal,
                    task: formatText,
                    time: 60,
                    elapsed: 0,
                    completed: false,
                    cancelled: false,
                    createdAt: (new Date()).toDateString()
                }
            });

            console.log(`🟢 Session started by ${userId}`);

            return;
        }

        const goal = await prisma.goals.findUnique({
            where: {
                goalId: userData.defaultGoal
            }
        });

        const view: View = {
            "type": "modal",
            "callback_id": CALLBACK_ID.START,
            "title": {
                "type": "plain_text",
                "text": "Start a Session",
                "emoji": true
            },
            "submit": {
                "type": "plain_text",
                "text": "Submit",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Cancel",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "input",
                    "element": {
                        "type": "plain_text_input",
                        "multiline": true,
                        "action_id": "task"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Label",
                        "emoji": true
                    },
                    "block_id": "task"
                },
                {
                    "type": "input",
                    "element": {
                        "type": "number_input",
                        "is_decimal_allowed": false,
                        "action_id": "minutes",
                        "initial_value": "60",
                        "min_value": "1",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Amount of time in minutes for the hack hour session"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "How long will this session be? (minutes)",
                        "emoji": true
                    },
                    "block_id": "minutes"
                },
                {
                    "type": "input",
                    "block_id": "attachment",
                    "label": {
                        "type": "plain_text",
                        "text": "Upload Files"
                    },
                    "element": {
                        "type": "file_input",
                        "action_id": "attachment",
                        "max_files": 1,
                    },
                    "optional": true
                },
                {
                    "type": "divider"
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Currently selected goal: *${goal?.goalName}* - _${formatHour(goal?.minutes)}_ hours completed`
                    }
                }
            ]
        };

        await client.views.open({
            trigger_id: body.trigger_id,
            view: view
        });
    });

    // Events

    /**
     * /events
     * Opens the reminders modal, allowing the user to set their reminder time
     */
    app.command(Commands.EVENTS, async ({ ack, body, client }) => {
        const userId = body.user_id;

        await ack();

        // Rejection if the user isn't in the database
        if (!await isUser(userId)) {
            await client.chat.postEphemeral({
                channel: Constants.HACK_HOUR_CHANNEL,
                text: `❌ You aren't a user yet. Please run \`/hack\` to get started.`,
                user: userId
            });
            return;
        }

        const user = await prisma.user.findUnique({
            where: {
                slackId: userId
            }
        });

        let eventIndex;
        if (user?.eventId == null || user?.eventId == undefined || user?.eventId == "none") {
            eventIndex = 0;
        } else {
            eventIndex = Object.keys(events).indexOf(user?.eventId) + 1;
        }

        const options = Object.keys(events).map(eventID => {
            const event = events[eventID];

            return {
                "text": {
                    "type": "mrkdwn",
                    "text": event.name,                                    
                },
                "description": {
                    "type": "mrkdwn",
                    "text": event.description,
                },
                "value": eventID,
            } as any;
        });

        options.unshift({
            "text": {
                "type": "mrkdwn",
                "text": "*No Event*"
            },
            "description": {
                "type": "mrkdwn",
                "text": "*Use Hack Hour without contributing to an event.*"
            },
            "value": "none"
        });

        const view: View = {
            "type": "modal",
            "callback_id": CALLBACK_ID.EVENTS,
            "title": {
                "type": "plain_text",
                "text": "Current Picnics (Events)",
                "emoji": true
            },
            "submit": {
                "type": "plain_text",
                "text": "Join",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Cancel",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "input",
                    "label": {
                        "type": "plain_text",
                        "text": "Select an event you want to particpate in. (You can only particpate in one event.)"
                    },
                    "element": {
                        "type": "radio_buttons",
                        "initial_option": options[eventIndex],
                        "options": options,
                        "action_id": "events"
                    },
                    "block_id": "events"                    
                }
            ]
        }

        await client.views.open({
            trigger_id: body.trigger_id,
            view: view
        });
    });

    /**
     * reminders
     * Make updates to the user's reminder time
     */
    app.view(CALLBACK_ID.EVENTS, async ({ ack, body, client }) => {
        const userId = body.user.id;
        const eventId = body.view.state.values.events.events.selected_option?.value;
 
        assertVal(eventId);

        if (eventId != "none") {            
            const result = await events[eventId].userJoin(userId);
            if (result) {
                await prisma.user.update({
                    where: {
                        slackId: userId
                    },
                    data: {
                        eventId: eventId
                    }
                }); 
                await ack();       
            } else {
                await ack({
                    response_action: 'errors',
                    errors: {
                        events: 'There was an error while joining this event. You may not be able to join this event.'
                    }
                });
            }
            return;
        }

        await prisma.user.update({
            where: {
                slackId: userId
            },
            data: {
                eventId: "none"
            }
        });

        await ack();
    });

    // Misc
    app.command(Commands.INSTRUCTIONS, async ({ ack, body, client }) => {
        await ack();

        await client.views.open({
            trigger_id: body.trigger_id,
            view: Views.WELCOME
        });
    });

    // Interval Updates

    /**
     * Minute interval
     * Interval to update the sessions
     */
    setInterval(async () => {
        const sessions = await prisma.session.findMany({
            where: {
                completed: false,
                cancelled: false
            }
        });

        console.log(`🕒 Updating ${sessions.length} sessions`);

        for (const session of sessions) {
            session.elapsed += 1;

            // Check if the message exists
            const message = await app.client.conversations.history({
                channel: Constants.HACK_HOUR_CHANNEL,
                latest: session.messageTs,
                limit: 1
            });  

            if (message.messages == undefined || message.messages.length == 0) {
                console.log(`❌ Session ${session.messageTs} does not exist`);
                continue;
            }

            let links;
            let attachments: string[];
            if (session.attachment) {
                attachments = JSON.parse(session.attachment);
                links = "\n" + attachments.join("\n");
            } else {
                links = "";
            }

            if (session.elapsed >= session.time) { // TODO: Commit hours to goal, verify hours with events                
                await prisma.session.update({
                    where: {
                        messageTs: session.messageTs
                    },
                    data: {
                        completed: true
                    }
                });

                await app.client.chat.update({
                    channel: Constants.HACK_HOUR_CHANNEL,
                    ts: session.messageTs,
                    text: format(randomChoice(Templates.completedTopLevel), {
                        userId: session.userId,
                        task: session.task
                    }) + links
                });

                await app.client.chat.postMessage({
                    thread_ts: session.messageTs,
                    channel: Constants.HACK_HOUR_CHANNEL,
                    text: format(randomChoice(Templates.completed), {
                        userId: session.userId
                    })
                });

                await prisma.goals.update({
                    where: {
                        goalId: session.goal
                    },
                    data: {
                        minutes: {
                            increment: session.time
                        }
                    }
                });

                await prisma.user.update({
                    where: {
                        slackId: session.userId
                    },
                    data: {
                        totalMinutes: {
                            increment: session.time
                        }
                    }
                });

                await app.client.reactions.add({
                    name: "tada",
                    channel: Constants.HACK_HOUR_CHANNEL,
                    timestamp: session.messageTs
                });

                console.log(`🏁 Session ${session.messageTs} completed by ${session.userId}`);

                // Events system
                const userInfo = await prisma.user.findUnique({
                    where: {
                        slackId: session.userId
                    }
                });

                if (userInfo?.eventId && userInfo?.eventId != "none") {
                    await events[userInfo.eventId].endSession(session);
                }

                continue;
            }
            else if (session.elapsed % 15 == 0) {
                // Send a reminder every 15 minutes
                await app.client.chat.postMessage({
                    thread_ts: session.messageTs,
                    channel: Constants.HACK_HOUR_CHANNEL,
                    text: format(randomChoice(Templates.sessionReminder), {
                        userId: session.userId,
                        minutes: String(session.time - session.elapsed)
                    })
                });
            }

            const formattedText = format(session.template, {
                userId: session.userId,
                minutes: String(session.time - session.elapsed),
                task: session.task
            }) + links;

            await prisma.session.update({
                where: {
                    messageTs: session.messageTs
                },
                data: {
                    elapsed: session.elapsed
                }
            });

            await app.client.chat.update({
                channel: Constants.HACK_HOUR_CHANNEL,
                ts: session.messageTs,
                text: formattedText,
            });
        }
    }, Constants.MIN_MS);

    /**
     * Hourly interval 
     * For reminders, events
     */
    setTimeout(async () => {
        setInterval(async () => {
            const now = new Date();
            const users = await prisma.user.findMany({
                where: {
                    remindersEnabled: true
                }
            });

            console.log(`🕒 Running reminders to ${users.length} users`);

            for (const user of users) {
                const userInfo = await app.client.users.info({
                    user: user.slackId
                });

                const tz = userInfo.user?.tz_offset; // the timezone offset in seconds
                assertVal(tz);
                let tzDate = new Date();
                tzDate.setHours(new Date().getUTCHours() + (tz / 3600));
                const tzHour: number = tzDate.getHours();
                const remindHour: number = Number.parseInt(user.reminder.split(":")[0]);

                console.log(`🕒 Checking ${user.slackId} at ${tzHour} against ${remindHour}`);

                if (tzHour != remindHour) {
                    continue;
                }

                // Check if the user already hacked today
                const sessions = await prisma.session.findMany({
                    where: {
                        userId: user.slackId,
                        createdAt: (new Date()).toDateString()
                    }
                });

                if (sessions.length > 0) {
                    continue;
                }

                await app.client.chat.postMessage({
                    channel: user.slackId,
                    text: `🕒 It's ${tzHour} o'clock! Time for your daily hack hour! Run \`/hack\` to get started.`
                });
            }

            console.log('🎈 Running event updates')

            for (const event in events) {
                events[event].hourlyCheck();
            }
        }, Constants.HOUR_MS);
    }, Constants.HOUR_MS - Date.now() % Constants.HOUR_MS);

    // App    
    if (!process.env.PORT) { throw new Error('❌ PORT is not defined in the environment'); }
    app.start(process.env.PORT);
    console.log('⏳ And the hour begins...');
})();