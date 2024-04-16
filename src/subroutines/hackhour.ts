import { app, prisma } from '../app.js';
import { Commands } from '../constants.js';
import { Callbacks, Views } from '../views/hackhour.js';

/**
 * hack
 * The command that starts the hack hour
 */
app.command(Commands.HACK, async ({ ack, body, client }) => {
    const text: string = body.text;
    const userId: string = body.user_id;

    await ack();
re
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

    await client.views.open({
        trigger_id: body.trigger_id,
        view: Views.start()
    });

    await ack();

    await client.views.open({
        trigger_id: body.trigger_id,
        view: Views.start()
    });
});

/**
 * start
 * Start the hack hour
 */
app.view(Callbacks.START, async ({ ack, body, client }) => {
    const session = body.view.state.values.session.session.value;
    const minutes = body.view.state.values.minutes.minutes.value;
    const files = body.view.state.values.files.files.files;

    await ack();


});