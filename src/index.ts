import bolt, { KnownBlock, RespondArguments, View } from '@slack/bolt'; 
import { CALLBACK_ID, Views, ACTION_ID } from './views/views.js';
import { Constants, Commands } from './constants.js';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
const { App } = bolt;
const prisma = new PrismaClient();
const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
});    

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
        const user: string = body.user_id;

        await ack();
      
        const userData = await prisma.user.findUnique({
            where: {
                slackId: user
            }
        });

        if (!userData) {
            await client.views.open({
                trigger_id: body.trigger_id,
                view: Views.WELCOME
            });
            return;
        }            
    });

    // Onboarding Flow

    /**
     * welcome
     * The modal that introduces the user to the hack hour
     * On submit, redirect to the onboarding modal
     */
    app.view(CALLBACK_ID.WELCOME, async ({ ack, body, client, logger }) => {
        // In case the user already exists, skip directly to the instructions modal
        const userData = await prisma.user.findUnique({
            where: {
                slackId: body.user.id
            }
        });

        if (userData) {
            await ack({
                response_action: 'push',
                view: Views.INSTRUCTIONS
            });
            return;
        }

        await ack({
            response_action: 'push',
            view: Views.SETUP
        });
    });

    /**
     * setup
     * The modal that allows the user to set up their preferences for hack hour
     * On submit, open a new modal that instructs the user on how to use the app
     */
    app.view(CALLBACK_ID.SETUP, async ({ ack, body, client, logger }) => {
        const userId = body.user.id;
        const time = body.view.state.values.reminder.reminder_time.selected_time; assertVal(time);
        const goal = body.view.state.values.goal.goal_text.value; assertVal(goal);
      
        const userInfo = await client.users.info({ user: userId }); assertVal(userInfo.user);
        const tz = userInfo.user.tz_offset; assertVal(tz);
      
        try {
            const defaultGoal = randomUUID();
            await prisma.user.create({
                data: {
                    slackId: userId,
                    totalHours: 0,
                    tz: String(tz),
                    remindersEnabled: true,
                    reminder: time,
                    goals: {
                        create: {
                            goalId: defaultGoal,
                            goalName: "No Goal",
                            hours: 0
                        }
                    },
                    defaultGoal: defaultGoal                    
                }
            });
            await prisma.goals.create({
                data: {
                    slackId: userId,
                    goalId: randomUUID(),
                    goalName: goal,
                    hours: 0
                }
            });
            console.log(`🛠️ Instantiated `);
        } catch (error) {
            console.error(error);
            await ack({
                response_action: 'errors',
                errors: {
                    goal: 'There was an error initializing hack hour. Please try again.'                    
                }
            });
        }

        await ack({
            response_action: 'update',
            view: Views.INSTRUCTIONS
        });      
    });

    /**
     * instructions
     * The modal that instructs the user on how to use the app
     * On submit, close the modal
     */
    app.view(CALLBACK_ID.INSTRUCTIONS, async ({ ack, body, client, logger }) => {
        await ack({
            response_action: 'clear'
        });
    });

    // Goals

    /**
     * /goals
     * Opens the goals modal, allow the user to create goals and select their default goal
     */
    app.command(Commands.GOALS, async ({ ack, body, client }) => {
        const userId = body.user_id;

        if (!await isUser(userId)) {
            // Reject them
            await ack("❌ You aren't a user yet. Please run `/hack` to get started.");
        } else {
            await ack();
        }
        
        const goals = await prisma.goals.findMany({
            where: {
                slackId: userId
            }
        });

        const options: bolt.Option[] = goals.map(goal => {
            return {
                text: {
                    type: 'plain_text',
                    text: goal.goalName,
                    emoji: true
                },
                value: goal.goalId
            }
        });

        // Manually generate this since typescript doesn't like it when I try to modify the view object
        const view: View = {
            "callback_id": CALLBACK_ID.GOALS,
            "type": "modal",
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
            "title": {
                "type": "plain_text",
                "text": "Goals",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "Select your goals:",
                        "emoji": true
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "radio_buttons",
                            "options": options,
                            "action_id": ACTION_ID.SELECT_GOAL
                        }
                    ],
                    "block_id": "goals"
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Create Goal",
                                "emoji": true
                            },
                            "value": "create",
                            "action_id": ACTION_ID.CREATE_GOAL
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Delete Goal",
                                "emoji": true
                            },
                            "value": "delete",
                            "action_id": ACTION_ID.DELETE_GOAL
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Set as Default Goal",
                                "emoji": true
                            },
                            "value": "setDefault",
                            "action_id": ACTION_ID.SET_DEFAULT
                        }
                    ]
                },
                {
                    "type": "divider"
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "You can select a goal to view your progress, create a new goal, delete a goal, or set a default goal."
                    }
                }
            ]
        };

        await client.views.open({
            trigger_id: body.trigger_id,
            view: view
        });
    });

    /**
     * selectGoal
     */
    app.action(ACTION_ID.SELECT_GOAL, async ({ ack, body, client }) => {
        ack();

        const goalId = (body as any).view.state.values.goals.selectGoal.selected_option.value;                

        // Recreate the view with information about the selected goal
        let blocks = (body as any).view.blocks;
        blocks.pop();
        blocks.pop();

        const goal = await prisma.goals.findUnique({
            where: {
                goalId: goalId
            }
        });

        blocks.push({
            "type": "divider"
        });

        blocks.push({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `You've spent *${goal?.hours}* hours working on _${goal?.goalName}_.`
            }
        });

        const view: View = {
            "callback_id": CALLBACK_ID.GOALS,
            "type": "modal",
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
            "title": {
                "type": "plain_text",
                "text": "Goals",
                "emoji": true
            },
            "blocks": blocks      
        };

        await client.views.update({
            view_id: (body as any).view.id,
            view: view
        });
    });
    
    /**
     * setDefault
     * The modal that allows the user to set a default goal
     */
    app.action(ACTION_ID.SET_DEFAULT, async ({ ack, body, client }) => {
        const userId = body.user.id;
        const goalId = (body as any).view.state.values.goals.selectGoal.selected_option.value;        

        // Update the user's default goal
        await prisma.user.update({
            where: {
                slackId: userId
            },
            data: {
                defaultGoal: goalId
            }
        });

        // Push default confirmation view
        await ack();

        // Recreate the view with information about the selected goal
        let blocks = (body as any).view.blocks;

        blocks.pop();
        blocks.pop();

        blocks.push({
            "type": "divider"
        });

        blocks.push({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `Set as default goal!`
            }
        });

        const view: View = {
            "callback_id": CALLBACK_ID.GOALS,
            "type": "modal",
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
            "title": {
                "type": "plain_text",
                "text": "Goals",
                "emoji": true
            },
            "blocks": blocks      
        };        

        await client.views.update({
            view_id: (body as any).view.id,
            view: view
        });

        console.log(`🎯 Set default goal for ${userId} to ${goalId}`);
     });
 
    /**
     * createGoal
     * The modal that allows the user to create a new goal
     */
    app.action(ACTION_ID.CREATE_GOAL, async ({ ack, body, client }) => {
        ack();

        await client.views.push({
            trigger_id: (body as any).trigger_id,
            view: Views.CREATE_GOAL
        });
    });

    /**
     * createGoal (modal)
     * On submission, create a new goal
     */
    app.view(CALLBACK_ID.CREATE_GOAL, async ({ ack, body, client }) => {
        const userId = body.user.id;
        const goalName = body.view.state.values.goal.goalName.value;

        // Make sure the goal name is valid
        if (goalName == null || goalName == "" || goalName == undefined) {
            await ack({
                response_action: 'errors',
                errors: {
                    goalName: 'Please enter a valid goal name.'
                }
            });
            return;
        }
        
        assertVal(goalName);

        await prisma.goals.create({
            data: {
                slackId: userId,
                goalId: randomUUID(),
                goalName: goalName,
                hours: 0
            }
        });

        // Return to previous view
        await ack({
            response_action: 'clear'
        });
    });

    /**
     * deleteGoal
     * The modal that allows the user to delete a goal
     */
    app.action(ACTION_ID.DELETE_GOAL, async ({ ack, body, client }) => {
        ack();

        let view = Views.DELETE_GOAL;
        view.private_metadata = (body as any).view.state.values.goals.selectGoal.selected_option.value;

        await client.views.push({
            trigger_id: (body as any).trigger_id,
            view: Views.DELETE_GOAL
        });
    });

    /**
     * deleteGoal (modal)
     * On submission, delete the selected goal
     */
    app.view(CALLBACK_ID.DELETE_GOAL, async ({ ack, body, client }) => {
        const goalId = body.view.private_metadata;

        console.log(goalId);
        console.log(`🗑️ Deleting goal ${goalId}`);

        await prisma.goals.delete({
            where: {
                goalId: goalId
            }
        });

        await ack({
            response_action: 'clear'
        });
    });

    
    app.start(process.env.PORT || 3000);
    console.log('⏳ And the hour begins...');
})();