import { app, prisma, minuteInterval, hourInterval } from '../app.js';
import { Commands, Environment } from '../constants.js';

import { Callbacks, Views, Actions } from '../views/hackhour.js';
import { Views as OnboardingViews } from '../views/onboarding.js';
import { Views as GoalViews } from '../views/goals.js';
import { Views as PicnicViews } from '../views/picnics.js';

import { Templates } from '../utils/message.js';
import { format, randomChoice } from '../utils/string.js';
import { reactOnContent } from '../utils/emoji.js';
import { assertVal } from '../utils/lib.js';
import { Blocks } from '../views/messages.js';

import { Picnics } from './events/picnics.js';
import { SlackCommandMiddlewareArgs } from '@slack/bolt';

import { websocketManager } from './api.js';

const powerHour = Picnics.find((picnic) => picnic.ID === "powerhour");
assertVal(powerHour);

/**
 * hack
 * The command that starts the hack hour
 */
const hack = async ({ ack, body }: SlackCommandMiddlewareArgs) => {
    const text: string = body.text;
    const userId: string = body.user_id;

    await ack();

    const userData = await prisma.user.findUnique({
        where: {
            slackId: userId
        }
    });

    if (!userData) {
        await app.client.views.open({
            trigger_id: body.trigger_id,
            view: OnboardingViews.welcome()
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
        await app.client.chat.postEphemeral({
            channel: Environment.MAIN_CHANNEL,
            text: `🚨 You're already in a session! Finish that one before starting a new one.`,
            user: userId
        });
        return;
    }

    // Check if there's text - if there is use shorthand mode
    if (text) {
        const template = randomChoice(Templates.minutesRemaining);

        const message = await app.client.chat.postMessage({
            channel: Environment.MAIN_CHANNEL,
            blocks: await Blocks.session({
                template: template,
                userId: userId,
                goal: userData.selectedGoal,
                task: text,
                time: 60
            }),
            text: text
        });

        assertVal(message.ts);

        reactOnContent(app, {
            content: text,
            channel: Environment.MAIN_CHANNEL,
            ts: message.ts
        });

        await prisma.session.create({
            data: {
                messageTs: message.ts,
                template: template,
                userId: userId,
                goal: userData.selectedGoal,
                task: text,
                time: 60,
                elapsed: 0,
                completed: false,
                cancelled: false,
                createdAt: (new Date()).toDateString()
            }
        });

        console.log(`🟢 Session started by ${userId}`);

        powerHour.createSession(userId, message.ts);

        websocketManager.startSession(userId);
   
        return;
    }

    await app.client.views.open({
        trigger_id: body.trigger_id,
        view: await Views.start(userId),
        private_metadata: body.trigger_id
    });
};

app.command(Commands.HACK, hack);
app.command(Commands.HACK_ALIAS, hack);

/**
 * start
 * Start the hack hour
 */
app.view(Callbacks.START, async ({ ack, body, client }) => {
    const userId = body.user.id;
    const task = body.view.state.values.session.session.value;
    const minutes = body.view.state.values.minutes.minutes.value;
    const attachments = body.view.state.values.files.files.files;

    await ack();

    const template = randomChoice(Templates.minutesRemaining);

    assertVal(userId);
    assertVal(task);
    assertVal(minutes);
    assertVal(attachments);

    let formattedText = format(template, {
        userId: userId,
        minutes: String(minutes),
        task: task
    });

    const userInfo = await prisma.user.findUnique({
        where: {
            slackId: userId
        }
    });
    const selectedGoal = userInfo?.selectedGoal;

    assertVal(selectedGoal);

    let links: string[] = [];
    let message;

    // If there's an attachment, add it
    if (attachments && attachments.length > 0) {
        links = attachments.map((attachment: any) => attachment.permalink);
        formattedText += "\n" + links.join("\n");

        message = await app.client.chat.postMessage({
            channel: Environment.MAIN_CHANNEL,
            text: formattedText,
            blocks: await Blocks.session({
                template: template,
                userId: userId,
                goal: selectedGoal,
                task: task,
                time: parseInt(minutes)
            }, links)
        });

        assertVal(message.ts);
        await prisma.session.create({
            data: {
                messageTs: message.ts,
                template: template,
                userId: userId,
                goal: selectedGoal,
                task: task,
                time: parseInt(minutes),
                elapsed: 0,
                completed: false,
                cancelled: false,
                attachment: JSON.stringify(links),
                createdAt: (new Date()).toDateString()
            }
        });
    } else {
        message = await app.client.chat.postMessage({
            channel: Environment.MAIN_CHANNEL,
            text: formattedText,
            blocks: await Blocks.session({
                template: template,
                userId: userId,
                goal: selectedGoal,
                task: task,
                time: parseInt(minutes)
            })
        });
        
        assertVal(message.ts);
        await prisma.session.create({
            data: {
                messageTs: message.ts,
                template: template,
                userId: userId,
                goal: selectedGoal,
                task: task,
                time: parseInt(minutes),
                elapsed: 0,
                completed: false,
                cancelled: false,
                createdAt: (new Date()).toDateString()
            }
        });
    }

    // Scan the message for any links and add them to links
    task.split("\n").forEach((line: string) => {
        if (line.includes("http")) {
            links.push(line);
        }
    });
   
    reactOnContent(app, {
        content: task,
        channel: Environment.MAIN_CHANNEL,
        ts: message.ts
    });

    console.log(`🟢 Session ${message.ts} started by ${userId}`);

    powerHour.createSession(userId, message.ts);

    websocketManager.startSession(userId);
});

/**
 * goals
 * Open the goals modal
 */
app.action(Actions.GOALS, async ({ ack, body, client }) => {
    const userId: string = body.user.id;
    const trigger_id: string = (body as any).trigger_id;

    await client.views.push({
        trigger_id: trigger_id,
        view: await GoalViews.goals(userId)
    });
});

/**
 * picnics
 * Open the picnics modal
 */
app.action(Actions.PICNICS, async ({ ack, body, client }) => {
    await ack();

    await client.views.push({
        trigger_id: (body as any).trigger_id,
        view: await PicnicViews.picnics(body.user.id)
    });
});

/**
 * cancel
 * Cancel the hack hour
 */
app.command(Commands.CANCEL, async ({ ack, body, client }) => {
    const userId = body.user_id;

    await ack();

    const userData = await prisma.user.findUnique({
        where: {
            slackId: userId
        }
    });

    if (!userData) {
        await client.chat.postEphemeral({
            channel: Environment.MAIN_CHANNEL,
            text: `❌ You aren't a user yet. Please run \`/hack\` to get started.`,
            user: userId
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

    if (!session) {
        await client.chat.postEphemeral({
            channel: Environment.MAIN_CHANNEL,
            text: `🚨 You're not in a session!`,
            user: userId
        });
        return;
    }

    await prisma.session.update({
        where: {
            messageTs: session.messageTs
        },
        data: {
            cancelled: true
        }
    });

    await prisma.goals.update({
        where: {
            goalId: session.goal
        },
        data: {
            minutes: {
                increment: session.elapsed
            }
        }
    });

    await prisma.user.update({
        where: {
            slackId: userId
        },
        data: {
            totalMinutes: {
                increment: session.elapsed
            }
        }
    });

    let links;
    if (session.attachment) {
        const permalinks: string[] = JSON.parse(session.attachment);
        links = "\n" + permalinks.join("\n");
    } else {
        links = "";
    }

    await client.chat.update({
        channel: Environment.MAIN_CHANNEL,
        ts: session.messageTs,
        text: session.task,
        blocks: await Blocks.session({
            template: randomChoice(Templates.cancelledTopLevel),
            userId: session.userId,
            goal: session.goal,
            task: session.task,
            time: session.time - session.elapsed
        })
    });

    await client.chat.postMessage({
        thread_ts: session.messageTs,
        channel: Environment.MAIN_CHANNEL,
        text: format(randomChoice(Templates.cancelled), {
            userId: userId
        })
    });

    await client.reactions.add({
        name: "x",
        channel: Environment.MAIN_CHANNEL,
        timestamp: session.messageTs
    });

    console.log(`🛑 Session ${session.messageTs} cancelled by ${userId}`);

    /*
    Picnics.forEach(async (picnic) => {
        if (picnic.ID === userData.eventId) {
            await picnic.cancelSession(session);
        }
    });*/
    powerHour.cancelSession(session);    

    websocketManager.endSession(userId, true);
});

/**
 * minuteInterval
 * The interval that updates the hack hour sessions every minute
 */
minuteInterval.attach(async () => {
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
            channel: Environment.MAIN_CHANNEL,
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
                channel: Environment.MAIN_CHANNEL,
                ts: session.messageTs,
                text: session.task,
                blocks: await Blocks.session({
                    template: randomChoice(Templates.completedTopLevel),
                    userId: session.userId,
                    goal: session.goal,
                    task: session.task,
                    time: session.time - session.elapsed
                })
            });

            await app.client.chat.postMessage({
                thread_ts: session.messageTs,
                channel: Environment.MAIN_CHANNEL,
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
                channel: Environment.MAIN_CHANNEL,
                timestamp: session.messageTs
            });

            console.log(`🏁 Session ${session.messageTs} completed by ${session.userId}`);
            
            /*
            Picnics.forEach(async (picnic) => {
                if (picnic.ID === session.goal) {
                    await picnic.endSession(session);
                }
            });
            */
           powerHour.endSession(session);

            websocketManager.endSession(session.userId, false);

            continue;
        }
        else if (session.elapsed % 15 == 0) {
            // Send a reminder every 15 minutes
            await app.client.chat.postMessage({
                thread_ts: session.messageTs,
                channel: Environment.MAIN_CHANNEL,
                text: format(randomChoice(Templates.sessionReminder), {
                    userId: session.userId,
                    minutes: String(session.time - session.elapsed)
                })
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
            channel: Environment.MAIN_CHANNEL,
            ts: session.messageTs,
            text: session.task,
            blocks: await Blocks.session({
                template: session.template,
                userId: session.userId,
                goal: session.goal,
                task: session.task,
                time: session.time - session.elapsed
            })     
        });
    }
})