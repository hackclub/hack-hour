import { app, prisma, hourInterval } from '../app.js';
import { Commands, Environment } from '../constants.js';

import { Callbacks as StatsCallbacks, Views as StatsViews } from '../views/stats.js';
import { Callbacks as RemindCallbacks, Views as RemindViews } from '../views/reminders.js';
import { assertVal } from '../utils/lib.js';

/**
 * mystats
 * Displays the user's stats
 */
app.command(Commands.STATS, async ({ ack, body, client }) => {
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

    await client.views.open({
        trigger_id: body.trigger_id,
        view: await StatsViews.stats(userId)
    });
});

/**
 * stats
 * Just close on submission
 */
app.view(StatsCallbacks.STATS, async ({ ack, body, client }) => {
    await ack();
});

/**
 * reminders
 * Displays the user's reminders
 */
app.command(Commands.REMINDERS, async ({ ack, body, client }) => {
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

    await client.views.open({
        trigger_id: body.trigger_id,
        view: await RemindViews.reminders(userId)
    });
});

app.view(RemindCallbacks.REMINDERS, async ({ ack, body, client }) => {
    const userId = body.user.id;
    const time = body.view.state.values.reminder.reminder_time.selected_time;

    await ack();

    assertVal(time);

    await prisma.user.update({
        where: {
            slackId: userId
        },
        data: {
            reminder: time
        }
    });
});

hourInterval.attach(async () => {
    const users = await prisma.user.findMany({
        where: {
            remindersEnabled: true
        }
    });

    console.log(`🕒 Running reminders to ${users.length} users`);

    for (const user of users) {
        const userData = await prisma.user.findUnique({
            where: {
                slackId: user.slackId
            }
        });
 
        assertVal(userData?.tz);
        const tz: number = parseInt(userData?.tz); // the timezone offset in seconds
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
});