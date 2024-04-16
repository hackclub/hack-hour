import { app, prisma } from '../app.js';
import { Callbacks, Views } from '../views/onboarding.js';
import { assertVal } from '../utils/lib.js';
import { randomUUID } from 'crypto';
import { Commands, Environment } from '../constants.js';
import { Views as HackViews } from '../views/hackhour.js';

/**
 * welcome
 * The modal that introduces the user to the hack hour
 * On submit, redirect to the onboarding modal
 */
app.view(Callbacks.WELCOME, async ({ ack, body, client, logger }) => {
    await ack({
        response_action: 'push',
        view: Views.setup()
    });
});

/**
 * setup
 * The modal that allows the user to set up their preferences for hack hour
 * On submit, open a new modal that instructs the user on how to use the app
 */
app.view(Callbacks.SETUP, async ({ ack, body, client, logger }) => {
    const userId = body.user.id;
    const time = body.view.state.values.reminder.reminder_time.selected_time; assertVal(time);

    const userInfo = await client.users.info({ user: userId }); assertVal(userInfo.user);
    const tz = userInfo.user.tz_offset; assertVal(tz);

    await prisma.user.create({
        data: {
            slackId: userId,
            totalMinutes: 0,
            tz: String(tz),
            remindersEnabled: true,
            reminder: time,
            goals: {
                create: {
                    goalId: randomUUID(),
                    goalName: "none",
                    minutes: 0
                }
            },
            defaultGoal: "none",
            eventId: "none"
        }
    });

    console.log(`🛠️ Instantiated user ${userId}`);

    await ack({
        response_action: 'update',
        view: Views.finish()
    });

    // Add user to the hack hour user group
    let users = await client.usergroups.users.list({
        usergroup: Environment.PING_USERGROUP
    });

    users.users?.push(userId);

    await client.usergroups.users.update({
        usergroup: Environment.PING_USERGROUP,
        users: users.users?.join(",") ?? ""
    });
});

/**
 * instructions
 * The modal that instructs the user on how to use the app
 * On submit, open the start session modal
 */
app.view(Callbacks.FINISH, async ({ ack, body, client, logger }) => {
    if (!body.view.root_view_id) {
        logger.error("No root view ID found");
        await ack({
            response_action: 'errors',
            errors: {
                "root_view_id": "No root view ID found"                
            }
        });
        return;
    }

    await client.views.update({
        view_id: body.view.root_view_id,
        view: HackViews.start()
    });

    await ack();
});

/**
 * instructions
 * The modal that instructs the user on how to use the app
 */
app.command(Commands.INSTRUCTIONS, async ({ ack, body, client }) => {
    await ack();

    await client.views.open({
        trigger_id: body.trigger_id,
        view: Views.instructions()
    });
});

/**
 * instructions
 * Close the instructions modal
 */
app.view(Callbacks.INSTRUCTIONS, async ({ ack }) => {
    await ack();
});