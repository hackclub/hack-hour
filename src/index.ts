import bolt, { KnownBlock, RespondArguments, View } from '@slack/bolt'; 
import { CALLBACK_ID, Views, ACTION_ID } from './views/views.js';
import { Constants, Commands } from './constants.js';
import { format, randomChoice, formatHour, genAttachmentBlock } from './lib.js';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Templates } from './message.js';
import { kMaxLength } from 'node:buffer';
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
                    cancelled: false        
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
                    "type":"section",
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
                    totalMinutes: 0,
                    tz: String(tz),
                    remindersEnabled: true,
                    reminder: time,
                    goals: {
                        create: {
                            goalId: defaultGoal,
                            goalName: goal,
                            minutes: 0
                        }
                    },
                    defaultGoal: defaultGoal,
                    event: null        
                }
            });
            await prisma.goals.create({
                data: {
                    slackId: userId,
                    goalId: randomUUID(),
                    goalName: "No Goal",
                    minutes: 0
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
        
        // Add user to the hack hour user group
        const users = await client.usergroups.users.list({
            usergroup: Constants.HACK_HOUR_USERGROUP
        });


        await client.usergroups.users.update({
            usergroup: Constants.HACK_HOUR_USERGROUP,
            users: users.users?.join(",") ?? ""
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
                                "text": "Set as Current Goal",
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
                        "text": "You can select a goal to view your progress, create a new goal, delete a goal, or set your current goal."
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
                "text": `You've spent *${formatHour(goal?.minutes)}* hours working on _${goal?.goalName}_.`
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
                "text": `Set as current goal!`
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
                minutes: 0
            }
        });

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

        let view: View = {
            "type": "modal",
            "callback_id": CALLBACK_ID.DELETE_GOAL,
            "submit": {
                "type": "plain_text",
                "text": "Yes",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "No",
                "emoji": true
            },
            "title": {
                "type": "plain_text",
                "text": "Goals",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "rich_text",
                    "elements": [
                        {
                            "type": "rich_text_section",
                            "elements": [
                                {
                                    "type": "text",
                                    "text": "Are you sure you want delete this goal?"
                                }
                            ]
                        }
                    ]
                }
            ],
            "private_metadata": (body as any).view.state.values.goals.selectGoal.selected_option.value
        };

        await client.views.push({
            trigger_id: (body as any).trigger_id,
            view: view
        });
    });

    /**
     * deleteGoal (modal)
     * On submission, delete the selected goal
     */
    app.view(CALLBACK_ID.DELETE_GOAL, async ({ ack, body, client }) => {
        const goalId = body.view.private_metadata;

        // Ensure that there exists at least one goal
        const goals = await prisma.goals.findMany({
            where: {
                slackId: body.user.id
            }
        });

        if (goals.length == 1) {
            await ack({
                response_action: 'update',
                view: {
                    "type": "modal",
                    "callback_id": CALLBACK_ID.GOALS_ERROR,
                    "submit": {
                        "type": "plain_text",
                        "text": "Okay",
                        "emoji": true
                    },
                    "close": {
                        "type": "plain_text",
                        "text": "Close",
                        "emoji": true
                    },
                    "title": {
                        "type": "plain_text",
                        "text": "Goals",
                        "emoji": true
                    },
                    "blocks": [
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "You must have at least one goal."
                            }
                        }
                    ]
                }
            });
            return;
        }

        // Ensure that the goal is not the default goal
        const user = await prisma.user.findUnique({
            where: {
                slackId: body.user.id
            }
        });

        if (user?.defaultGoal == goalId) {
            await ack({
                response_action: 'update',
                view: {
                    "type": "modal",
                    "callback_id": CALLBACK_ID.GOALS_ERROR,
                    "submit": {
                        "type": "plain_text",
                        "text": "Okay",
                        "emoji": true
                    },
                    "close": {
                        "type": "plain_text",
                        "text": "Close",
                        "emoji": true
                    },
                    "title": {
                        "type": "plain_text",
                        "text": "Goals",
                        "emoji": true
                    },
                    "blocks": [
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "You cannot delete your currently selected goal."
                            }
                        }
                    ]
                }
            });
            return;
        }

        console.log(`🗑️  Deleting goal ${goalId}`);

        await prisma.goals.delete({
            where: {
                goalId: goalId
            }
        });

        await ack({
            response_action: 'clear'
        });
    });

    /**
     * errorMinGoals
     * Just close on submission
     */
    app.view(CALLBACK_ID.GOALS_ERROR, async ({ ack, body, client }) => {
        await ack();
    });

    /**
     * goals
     * Just close on submission
     */
    app.view(CALLBACK_ID.GOALS, async ({ ack, body, client }) => {
        await ack({
            response_action: 'clear'
        });
    });
    // Sessions
    
    /**
     * cancel
     * Cancels the current session
     */
    app.command(Commands.CANCEL, async ({ ack, body, client }) => {
        const userId = body.user_id;

        await ack();

        const session = await prisma.session.findFirst({
            where: {
                userId: userId,
                completed: false,
                cancelled: false
            }
        });

        if (!session) {
            await client.chat.postEphemeral({
                channel: Constants.HACK_HOUR_CHANNEL,
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

        const blocks: any = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": format(randomChoice(Templates.cancelledTopLevel), {
                        userId: userId,
                        task: session.task
                    })
                }
            }                
        ];

        if (session.attachment) {
            blocks.push(genAttachmentBlock(session.attachment));
        }

        await client.chat.update({
            channel: Constants.HACK_HOUR_CHANNEL,
            ts: session.messageTs,
            text: format(randomChoice(Templates.cancelledTopLevel), {
                userId: userId,
                task: session.task
            }),
            blocks: blocks
        });

        await client.chat.postMessage({
            thread_ts: session.messageTs,
            channel: Constants.HACK_HOUR_CHANNEL,
            text: format(randomChoice(Templates.cancelled), {
                userId: userId
            })
        });

        console.log(`🛑 Session ${session.messageTs} cancelled by ${userId}`);
    });

    /**
     * start
     * Starts a new session with the given parameters
     */
    app.view(CALLBACK_ID.START, async ({ ack, body, client }) => {
        const userId = body.user.id;
        const unformattedTask = body.view.state.values.task.task.value;
        const minutes = body.view.state.values.minutes.minutes.value;
        const attachments = body.view.state.values.attachment.attachment.files; 

        await ack();

        const template = randomChoice(Templates.minutesRemaining);

        assertVal(userId);
        assertVal(unformattedTask);
        assertVal(minutes);
        assertVal(attachments);

        const task = unformattedTask.split("\n").map((line: string) => `> ${line}`).join("\n"); // Split the task into lines, then reattach them with a > in front

        const formattedText = format(template, {
            userId: userId,
            minutes: String(minutes),
            task: task
        });

        let blocks: any = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": formattedText
                }
            }
        ];

        const userInfo = await prisma.user.findUnique({
            where: {
                slackId: userId
            }
        });
        const defaultGoal = userInfo?.defaultGoal;

        assertVal(defaultGoal);

        let message;

        // If there's an attachment, add it
        if (attachments[0]) {
            blocks.push(genAttachmentBlock(JSON.stringify(attachments)));
            message = await app.client.chat.postMessage({
                channel: Constants.HACK_HOUR_CHANNEL,
                blocks: blocks,
                text: formattedText,
            });                   
            assertVal(message.ts);
            await prisma.session.create({
                data: {
                    messageTs: message.ts,
                    template: template,
                    userId: userId,
                    goal: defaultGoal,
                    task: task,
                    time: parseInt(minutes),
                    elapsed: 0,
                    completed: false,
                    cancelled: false,
                    attachment: JSON.stringify(attachments[0])
                }            
            });
        } else {
            message = await app.client.chat.postMessage({
                channel: Constants.HACK_HOUR_CHANNEL,
                blocks: blocks,
                text: formattedText,
            });                   
            assertVal(message.ts);
            await prisma.session.create({
                data: {
                    messageTs: message.ts,
                    template: template,
                    userId: userId,
                    goal: defaultGoal,
                    task: task,
                    time: parseInt(minutes),
                    elapsed: 0,
                    completed: false,
                    cancelled: false
                }
            });
        }

        console.log(`🟢 Session ${message.ts} started by ${userId}`);
    });

    // Interval Updates
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

            let blocks: any[] = [];

            if (session.attachment) {
                blocks.push(genAttachmentBlock(session.attachment));
            }

            if (session.elapsed >= session.time) { // TODO: Commit hours to goal, verify hours with events                
                blocks.unshift({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": format(randomChoice(Templates.completedTopLevel), {
                            userId: session.userId,
                            task: session.task
                        })
                    }
                });

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
                    blocks: blocks,
                    text: format(randomChoice(Templates.completedTopLevel), {
                        userId: session.userId,
                        task: session.task
                    })
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

                // Future proofing for events
                // WHERE events IS Event[] and Event has a verify method                
                // for (const event of events)
                // if user has event
                // event.verify(app, prisma, userId, session);

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
            });

            blocks.unshift({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": formattedText
                }
            });

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
                    blocks: blocks,
                    text: formattedText,
            });
        }
    }, Constants.MIN_MS);
    
    // App    
    app.start(process.env.PORT || 3000);
    console.log('⏳ And the hour begins...');
})();