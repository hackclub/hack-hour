var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import bolt from '@slack/bolt';
import { CALLBACK_ID, Views, ACTION_ID } from './views/views.js';
import { Constants, Commands } from './constants.js';
import { format, randomChoice, formatHour } from './lib.js';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Templates } from './message.js';
import { reactOnContent } from './emoji.js';
import { genEvents } from './events/events.js';
const { App } = bolt;
const prisma = new PrismaClient();
const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    //  socketMode: true,
});
const events = genEvents(app, prisma);
function assertVal(value) {
    // Throw if the value is undefined
    if (value === undefined) {
        throw new Error(`${value} is undefined, needs to be type ${typeof value}`);
    }
    else if (value === null) {
        throw new Error(`${value} is null, needs to be type ${typeof value}`);
    }
}
function isUser(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield prisma.user.findUnique({
            where: {
                slackId: userId
            }
        });
        return user !== null;
    });
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    /**
     * /hack
     * Entrypoint to hack hour
     */
    app.command(Commands.HACK, (_a) => __awaiter(void 0, [_a], void 0, function* ({ ack, body, client }) {
        const text = body.text;
        const userId = body.user_id;
        yield ack();
        const userData = yield prisma.user.findUnique({
            where: {
                slackId: userId
            }
        });
        if (!userData) {
            yield client.views.open({
                trigger_id: body.trigger_id,
                view: Views.WELCOME
            });
            return;
        }
        const session = yield prisma.session.findFirst({
            where: {
                userId: userId,
                completed: false,
                cancelled: false
            }
        });
        if (session) {
            yield client.chat.postEphemeral({
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
            const message = yield client.chat.postMessage({
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
            yield prisma.session.create({
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
        const goal = yield prisma.goals.findUnique({
            where: {
                goalId: userData.defaultGoal
            }
        });
        const view = {
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
                        "text": `Currently selected goal: *${goal === null || goal === void 0 ? void 0 : goal.goalName}* - _${formatHour(goal === null || goal === void 0 ? void 0 : goal.minutes)}_ hours completed`
                    }
                }
            ]
        };
        yield client.views.open({
            trigger_id: body.trigger_id,
            view: view
        });
    }));
    // Onboarding Flow
    /**
     * welcome
     * The modal that introduces the user to the hack hour
     * On submit, redirect to the onboarding modal
     */
    app.view(CALLBACK_ID.WELCOME, (_b) => __awaiter(void 0, [_b], void 0, function* ({ ack, body, client, logger }) {
        // In case the user already exists, skip directly to the instructions modal
        const userData = yield prisma.user.findUnique({
            where: {
                slackId: body.user.id
            }
        });
        if (userData) {
            yield ack({
                response_action: 'push',
                view: Views.INSTRUCTIONS
            });
            return;
        }
        yield ack({
            response_action: 'push',
            view: Views.SETUP
        });
    }));
    /**
     * setup
     * The modal that allows the user to set up their preferences for hack hour
     * On submit, open a new modal that instructs the user on how to use the app
     */
    app.view(CALLBACK_ID.SETUP, (_c) => __awaiter(void 0, [_c], void 0, function* ({ ack, body, client, logger }) {
        var _d, _e, _f;
        const userId = body.user.id;
        const time = body.view.state.values.reminder.reminder_time.selected_time;
        assertVal(time);
        const goal = body.view.state.values.goal.goal_text.value;
        assertVal(goal);
        const userInfo = yield client.users.info({ user: userId });
        assertVal(userInfo.user);
        const tz = userInfo.user.tz_offset;
        assertVal(tz);
        try {
            const defaultGoal = randomUUID();
            yield prisma.user.create({
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
                    eventId: "none"
                }
            });
            yield prisma.goals.create({
                data: {
                    slackId: userId,
                    goalId: randomUUID(),
                    goalName: "No Goal",
                    minutes: 0
                }
            });
            console.log(`🛠️ Instantiated `);
        }
        catch (error) {
            console.error(error);
            yield ack({
                response_action: 'errors',
                errors: {
                    goal: 'There was an error initializing hack hour. Please try again.'
                }
            });
        }
        yield ack({
            response_action: 'update',
            view: Views.INSTRUCTIONS
        });
        // Add user to the hack hour user group
        let users = yield client.usergroups.users.list({
            usergroup: Constants.HACK_HOUR_USERGROUP
        });
        (_d = users.users) === null || _d === void 0 ? void 0 : _d.push(userId);
        yield client.usergroups.users.update({
            usergroup: Constants.HACK_HOUR_USERGROUP,
            users: (_f = (_e = users.users) === null || _e === void 0 ? void 0 : _e.join(",")) !== null && _f !== void 0 ? _f : ""
        });
    }));
    /**
     * instructions
     * The modal that instructs the user on how to use the app
     * On submit, close the modal
     */
    app.view(CALLBACK_ID.INSTRUCTIONS, (_g) => __awaiter(void 0, [_g], void 0, function* ({ ack, body, client, logger }) {
        // Check if the user has 0 minutes
        const userId = body.user.id;
        const userData = yield prisma.user.findUnique({
            where: {
                slackId: userId
            }
        });
        if ((userData === null || userData === void 0 ? void 0 : userData.totalMinutes) == 0) {
            const goal = yield prisma.goals.findUnique({
                where: {
                    goalId: userData.defaultGoal
                }
            });
            const view = {
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
                            "text": `Currently selected goal: *${goal === null || goal === void 0 ? void 0 : goal.goalName}* - _${formatHour(goal === null || goal === void 0 ? void 0 : goal.minutes)}_ hours completed`
                        }
                    }
                ]
            };
            if (body.view.root_view_id == undefined) {
                yield ack({
                    response_action: 'clear'
                });
                return;
            }
            yield client.views.update({
                view_id: body.view.root_view_id,
                view: view
            });
            yield ack();
            return;
        }
        yield ack({
            response_action: 'clear'
        });
    }));
    // Goals
    /**
     * /goals
     * Opens the goals modal, allow the user to create goals and select their default goal
     */
    app.command(Commands.GOALS, (_h) => __awaiter(void 0, [_h], void 0, function* ({ ack, body, client }) {
        const userId = body.user_id;
        if (!(yield isUser(userId))) {
            // Reject them
            yield ack("❌ You aren't a user yet. Please run `/hack` to get started.");
        }
        else {
            yield ack();
        }
        const goals = yield prisma.goals.findMany({
            where: {
                slackId: userId
            }
        });
        const options = goals.map(goal => {
            return {
                text: {
                    type: 'plain_text',
                    text: goal.goalName,
                    emoji: true
                },
                value: goal.goalId
            };
        });
        // Manually generate this since typescript doesn't like it when I try to modify the view object
        const view = {
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
        yield client.views.open({
            trigger_id: body.trigger_id,
            view: view
        });
    }));
    /**
     * selectGoal
     */
    app.action(ACTION_ID.SELECT_GOAL, (_j) => __awaiter(void 0, [_j], void 0, function* ({ ack, body, client }) {
        yield ack();
        const goalId = body.view.state.values.goals.selectGoal.selected_option.value;
        // Recreate the view with information about the selected goal
        let blocks = body.view.blocks;
        blocks.pop();
        blocks.pop();
        const goal = yield prisma.goals.findUnique({
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
                "text": `You've spent *${formatHour(goal === null || goal === void 0 ? void 0 : goal.minutes)}* hours working on _${goal === null || goal === void 0 ? void 0 : goal.goalName}_.`
            }
        });
        const view = {
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
        yield client.views.update({
            view_id: body.view.id,
            view: view
        });
    }));
    /**
     * setDefault
     * The modal that allows the user to set a default goal
     */
    app.action(ACTION_ID.SET_DEFAULT, (_k) => __awaiter(void 0, [_k], void 0, function* ({ ack, body, client }) {
        const userId = body.user.id;
        const goalId = body.view.state.values.goals.selectGoal.selected_option.value;
        // Update the user's default goal
        yield prisma.user.update({
            where: {
                slackId: userId
            },
            data: {
                defaultGoal: goalId
            }
        });
        // Push default confirmation view
        yield ack();
        // Recreate the view with information about the selected goal
        let blocks = body.view.blocks;
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
        const view = {
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
        yield client.views.update({
            view_id: body.view.id,
            view: view
        });
        console.log(`🎯 Set default goal for ${userId} to ${goalId}`);
    }));
    /**
     * createGoal
     * The modal that allows the user to create a new goal
     */
    app.action(ACTION_ID.CREATE_GOAL, (_l) => __awaiter(void 0, [_l], void 0, function* ({ ack, body, client }) {
        yield ack();
        yield client.views.push({
            trigger_id: body.trigger_id,
            view: Views.CREATE_GOAL
        });
    }));
    /**
     * createGoal (modal)
     * On submission, create a new goal
     */
    app.view(CALLBACK_ID.CREATE_GOAL, (_m) => __awaiter(void 0, [_m], void 0, function* ({ ack, body, client }) {
        const userId = body.user.id;
        const goalName = body.view.state.values.goal.goalName.value;
        // Make sure the goal name is valid
        if (goalName == null || goalName == "" || goalName == undefined) {
            yield ack({
                response_action: 'errors',
                errors: {
                    goalName: 'Please enter a valid goal name.'
                }
            });
            return;
        }
        assertVal(goalName);
        yield prisma.goals.create({
            data: {
                slackId: userId,
                goalId: randomUUID(),
                goalName: goalName,
                minutes: 0
            }
        });
        yield ack({
            response_action: 'clear'
        });
    }));
    /**
     * deleteGoal
     * The modal that allows the user to delete a goal
     */
    app.action(ACTION_ID.DELETE_GOAL, (_o) => __awaiter(void 0, [_o], void 0, function* ({ ack, body, client }) {
        yield ack();
        let view = {
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
            "private_metadata": body.view.state.values.goals.selectGoal.selected_option.value
        };
        yield client.views.push({
            trigger_id: body.trigger_id,
            view: view
        });
    }));
    /**
     * deleteGoal (modal)
     * On submission, delete the selected goal
     */
    app.view(CALLBACK_ID.DELETE_GOAL, (_p) => __awaiter(void 0, [_p], void 0, function* ({ ack, body, client }) {
        const goalId = body.view.private_metadata;
        // Ensure that there exists at least one goal
        const goals = yield prisma.goals.findMany({
            where: {
                slackId: body.user.id
            }
        });
        if (goals.length == 1) {
            yield ack({
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
        const user = yield prisma.user.findUnique({
            where: {
                slackId: body.user.id
            }
        });
        if ((user === null || user === void 0 ? void 0 : user.defaultGoal) == goalId) {
            yield ack({
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
        yield prisma.goals.delete({
            where: {
                goalId: goalId
            }
        });
        yield ack({
            response_action: 'clear'
        });
    }));
    /**
     * errorMinGoals
     * Just close on submission
     */
    app.view(CALLBACK_ID.GOALS_ERROR, (_q) => __awaiter(void 0, [_q], void 0, function* ({ ack, body, client }) {
        yield ack();
    }));
    /**
     * goals
     * Just close on submission
     */
    app.view(CALLBACK_ID.GOALS, (_r) => __awaiter(void 0, [_r], void 0, function* ({ ack, body, client }) {
        yield ack({
            response_action: 'clear'
        });
    }));
    // Sessions
    /**
     * cancel
     * Cancels the current session
     */
    app.command(Commands.CANCEL, (_s) => __awaiter(void 0, [_s], void 0, function* ({ ack, body, client }) {
        const userId = body.user_id;
        yield ack();
        if (!(yield isUser(userId))) {
            yield client.chat.postEphemeral({
                channel: Constants.HACK_HOUR_CHANNEL,
                text: `❌ You aren't a user yet. Please run \`/hack\` to get started.`,
                user: userId
            });
            return;
        }
        const session = yield prisma.session.findFirst({
            where: {
                userId: userId,
                completed: false,
                cancelled: false
            }
        });
        if (!session) {
            yield client.chat.postEphemeral({
                channel: Constants.HACK_HOUR_CHANNEL,
                text: `🚨 You're not in a session!`,
                user: userId
            });
            return;
        }
        yield prisma.session.update({
            where: {
                messageTs: session.messageTs
            },
            data: {
                cancelled: true
            }
        });
        yield prisma.goals.update({
            where: {
                goalId: session.goal
            },
            data: {
                minutes: {
                    increment: session.elapsed
                }
            }
        });
        yield prisma.user.update({
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
            const permalinks = JSON.parse(session.attachment);
            links = "\n" + permalinks.join("\n");
        }
        else {
            links = "";
        }
        yield client.chat.update({
            channel: Constants.HACK_HOUR_CHANNEL,
            ts: session.messageTs,
            text: format(randomChoice(Templates.cancelledTopLevel), {
                userId: userId,
                task: session.task
            }) + links,
        });
        yield client.chat.postMessage({
            thread_ts: session.messageTs,
            channel: Constants.HACK_HOUR_CHANNEL,
            text: format(randomChoice(Templates.cancelled), {
                userId: userId
            })
        });
        yield client.reactions.add({
            name: "x",
            channel: Constants.HACK_HOUR_CHANNEL,
            timestamp: session.messageTs
        });
        // Events system
        const userInfo = yield prisma.user.findUnique({
            where: {
                slackId: session.userId
            }
        });
        if ((userInfo === null || userInfo === void 0 ? void 0 : userInfo.eventId) && (userInfo === null || userInfo === void 0 ? void 0 : userInfo.eventId) != "none") {
            yield events[userInfo.eventId].cancelSession(session);
        }
        console.log(`🛑 Session ${session.messageTs} cancelled by ${userId}`);
    }));
    /**
     * start
     * Starts a new session with the given parameters
     */
    app.view(CALLBACK_ID.START, (_t) => __awaiter(void 0, [_t], void 0, function* ({ ack, body, client }) {
        const userId = body.user.id;
        const unformattedTask = body.view.state.values.task.task.value;
        const minutes = body.view.state.values.minutes.minutes.value;
        const attachments = body.view.state.values.attachment.attachment.files;
        yield ack();
        const template = randomChoice(Templates.minutesRemaining);
        assertVal(userId);
        assertVal(unformattedTask);
        assertVal(minutes);
        assertVal(attachments);
        const task = unformattedTask.split("\n").map((line) => `> ${line}`).join("\n"); // Split the task into lines, then reattach them with a > in front
        let formattedText = format(template, {
            userId: userId,
            minutes: String(minutes),
            task: task
        });
        const userInfo = yield prisma.user.findUnique({
            where: {
                slackId: userId
            }
        });
        const defaultGoal = userInfo === null || userInfo === void 0 ? void 0 : userInfo.defaultGoal;
        assertVal(defaultGoal);
        let links = [];
        let message;
        // If there's an attachment, add it
        if (attachments) {
            links = attachments.map((attachment) => attachment.permalink);
            formattedText += "\n" + links.join("\n");
            message = yield app.client.chat.postMessage({
                channel: Constants.HACK_HOUR_CHANNEL,
                text: formattedText,
            });
            assertVal(message.ts);
            yield prisma.session.create({
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
                    attachment: JSON.stringify(links),
                    createdAt: (new Date()).toDateString()
                }
            });
        }
        else {
            message = yield app.client.chat.postMessage({
                channel: Constants.HACK_HOUR_CHANNEL,
                text: formattedText,
            });
            assertVal(message.ts);
            yield prisma.session.create({
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
                    createdAt: (new Date()).toDateString()
                }
            });
        }
        // Scan the message for any links and add them to links
        task.split("\n").forEach((line) => {
            if (line.includes("http")) {
                links.push(line);
            }
        });
        reactOnContent(app, {
            content: task,
            channel: Constants.HACK_HOUR_CHANNEL,
            ts: message.ts
        });
        console.log(`🟢 Session ${message.ts} started by ${userId}`);
    }));
    // Stats
    /**
     * mystats
     * Displays the user's stats
     */
    app.command(Commands.STATS, (_u) => __awaiter(void 0, [_u], void 0, function* ({ ack, body, client }) {
        const userId = body.user_id;
        yield ack();
        // Rejection if the user isn't in the database
        if (!(yield isUser(userId))) {
            yield client.chat.postEphemeral({
                channel: Constants.HACK_HOUR_CHANNEL,
                text: `❌ You aren't a user yet. Please run \`/hack\` to get started.`,
                user: userId
            });
            return;
        }
        const userData = yield prisma.user.findUnique({
            where: {
                slackId: userId
            }
        });
        const goals = yield prisma.goals.findMany({
            where: {
                slackId: userId
            }
        });
        const blocks = goals.map(goal => {
            return {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `*${goal.goalName}*: ${formatHour(goal.minutes)} hours spent\n_(${goal.minutes} minutes)_`
                }
            };
        });
        blocks.unshift({
            "type": "divider"
        });
        blocks.unshift({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `*Lifetime Hours Spent*: ${formatHour(userData === null || userData === void 0 ? void 0 : userData.totalMinutes)}\n_(${userData === null || userData === void 0 ? void 0 : userData.totalMinutes} minutes)_`
            }
        });
        const view = {
            "type": "modal",
            "callback_id": CALLBACK_ID.STATS,
            "title": {
                "type": "plain_text",
                "text": "My Stats",
                "emoji": true
            },
            "submit": {
                "type": "plain_text",
                "text": "Done",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Close",
                "emoji": true
            },
            "blocks": blocks
        };
        yield client.views.open({
            trigger_id: body.trigger_id,
            view: view
        });
    }));
    /**
     * stats
     * Just close on submission
     */
    app.view(CALLBACK_ID.STATS, (_v) => __awaiter(void 0, [_v], void 0, function* ({ ack, body, client }) {
        yield ack();
    }));
    // Reminders
    /**
     * /reminders
     * Opens the reminders modal, allowing the user to set their reminder time
     */
    app.command(Commands.REMINDERS, (_w) => __awaiter(void 0, [_w], void 0, function* ({ ack, body, client }) {
        var _x;
        const userId = body.user_id;
        yield ack();
        if (!(yield isUser(userId))) {
            yield client.chat.postEphemeral({
                channel: Constants.HACK_HOUR_CHANNEL,
                text: `❌ You aren't a user yet. Please run \`/hack\` to get started.`,
                user: userId
            });
            return;
        }
        const userData = yield prisma.user.findUnique({
            where: {
                slackId: userId
            }
        });
        const view = {
            "type": "modal",
            "callback_id": CALLBACK_ID.REMINDERS,
            "title": {
                "type": "plain_text",
                "text": "Reminders",
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
                        "type": "timepicker",
                        "action_id": "reminder_time",
                        "initial_time": (_x = userData === null || userData === void 0 ? void 0 : userData.reminder) !== null && _x !== void 0 ? _x : "15:00",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Select a time"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "What time would you like to be reminded to hack hour?"
                    },
                    "block_id": "reminder"
                }
            ]
        };
        yield client.views.open({
            trigger_id: body.trigger_id,
            view: view
        });
    }));
    /**
     * reminders
     * Make updates to the user's reminder time
     */
    app.view(CALLBACK_ID.REMINDERS, (_y) => __awaiter(void 0, [_y], void 0, function* ({ ack, body, client }) {
        const userId = body.user.id;
        const time = body.view.state.values.reminder.reminder_time.selected_time;
        yield ack();
        assertVal(time);
        yield prisma.user.update({
            where: {
                slackId: userId
            },
            data: {
                reminder: time
            }
        });
    }));
    // Events
    /**
     * /events
     * Opens the reminders modal, allowing the user to set their reminder time
     */
    app.command(Commands.EVENTS, (_z) => __awaiter(void 0, [_z], void 0, function* ({ ack, body, client }) {
        const userId = body.user_id;
        yield ack();
        // Rejection if the user isn't in the database
        if (!(yield isUser(userId))) {
            yield client.chat.postEphemeral({
                channel: Constants.HACK_HOUR_CHANNEL,
                text: `❌ You aren't a user yet. Please run \`/hack\` to get started.`,
                user: userId
            });
            return;
        }
        const user = yield prisma.user.findUnique({
            where: {
                slackId: userId
            }
        });
        let eventIndex;
        if ((user === null || user === void 0 ? void 0 : user.eventId) == null || (user === null || user === void 0 ? void 0 : user.eventId) == undefined || (user === null || user === void 0 ? void 0 : user.eventId) == "none") {
            eventIndex = 0;
        }
        else {
            eventIndex = Object.keys(events).indexOf(user === null || user === void 0 ? void 0 : user.eventId) + 1;
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
            };
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
        const view = {
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
        };
        yield client.views.open({
            trigger_id: body.trigger_id,
            view: view
        });
    }));
    /**
     * reminders
     * Make updates to the user's reminder time
     */
    app.view(CALLBACK_ID.EVENTS, (_0) => __awaiter(void 0, [_0], void 0, function* ({ ack, body, client }) {
        var _1;
        const userId = body.user.id;
        const eventId = (_1 = body.view.state.values.events.events.selected_option) === null || _1 === void 0 ? void 0 : _1.value;
        assertVal(eventId);
        if (eventId != "none") {
            const result = yield events[eventId].userJoin(userId);
            if (result) {
                yield prisma.user.update({
                    where: {
                        slackId: userId
                    },
                    data: {
                        eventId: eventId
                    }
                });
                yield ack();
            }
            else {
                yield ack({
                    response_action: 'errors',
                    errors: {
                        events: 'There was an error while joining this event. You may not be able to join this event.'
                    }
                });
            }
            return;
        }
        yield prisma.user.update({
            where: {
                slackId: userId
            },
            data: {
                eventId: "none"
            }
        });
        yield ack();
    }));
    // Misc
    app.command(Commands.INSTRUCTIONS, (_2) => __awaiter(void 0, [_2], void 0, function* ({ ack, body, client }) {
        yield ack();
        yield client.views.open({
            trigger_id: body.trigger_id,
            view: Views.WELCOME
        });
    }));
    // Interval Updates
    /**
     * Minute interval
     * Interval to update the sessions
     */
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        const sessions = yield prisma.session.findMany({
            where: {
                completed: false,
                cancelled: false
            }
        });
        console.log(`🕒 Updating ${sessions.length} sessions`);
        for (const session of sessions) {
            session.elapsed += 1;
            // Check if the message exists
            const message = yield app.client.conversations.history({
                channel: Constants.HACK_HOUR_CHANNEL,
                latest: session.messageTs,
                limit: 1
            });
            if (message.messages == undefined || message.messages.length == 0) {
                console.log(`❌ Session ${session.messageTs} does not exist`);
                continue;
            }
            let links;
            let attachments;
            if (session.attachment) {
                attachments = JSON.parse(session.attachment);
                links = "\n" + attachments.join("\n");
            }
            else {
                links = "";
            }
            if (session.elapsed >= session.time) { // TODO: Commit hours to goal, verify hours with events                
                yield prisma.session.update({
                    where: {
                        messageTs: session.messageTs
                    },
                    data: {
                        completed: true
                    }
                });
                yield app.client.chat.update({
                    channel: Constants.HACK_HOUR_CHANNEL,
                    ts: session.messageTs,
                    text: format(randomChoice(Templates.completedTopLevel), {
                        userId: session.userId,
                        task: session.task
                    }) + links
                });
                yield app.client.chat.postMessage({
                    thread_ts: session.messageTs,
                    channel: Constants.HACK_HOUR_CHANNEL,
                    text: format(randomChoice(Templates.completed), {
                        userId: session.userId
                    })
                });
                yield prisma.goals.update({
                    where: {
                        goalId: session.goal
                    },
                    data: {
                        minutes: {
                            increment: session.time
                        }
                    }
                });
                yield prisma.user.update({
                    where: {
                        slackId: session.userId
                    },
                    data: {
                        totalMinutes: {
                            increment: session.time
                        }
                    }
                });
                yield app.client.reactions.add({
                    name: "tada",
                    channel: Constants.HACK_HOUR_CHANNEL,
                    timestamp: session.messageTs
                });
                console.log(`🏁 Session ${session.messageTs} completed by ${session.userId}`);
                // Events system
                const userInfo = yield prisma.user.findUnique({
                    where: {
                        slackId: session.userId
                    }
                });
                if ((userInfo === null || userInfo === void 0 ? void 0 : userInfo.eventId) && (userInfo === null || userInfo === void 0 ? void 0 : userInfo.eventId) != "none") {
                    yield events[userInfo.eventId].endSession(session);
                }
                continue;
            }
            else if (session.elapsed % 15 == 0) {
                // Send a reminder every 15 minutes
                yield app.client.chat.postMessage({
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
            yield prisma.session.update({
                where: {
                    messageTs: session.messageTs
                },
                data: {
                    elapsed: session.elapsed
                }
            });
            yield app.client.chat.update({
                channel: Constants.HACK_HOUR_CHANNEL,
                ts: session.messageTs,
                text: formattedText,
            });
        }
    }), Constants.MIN_MS);
    /**
     * Hourly interval
     * For reminders, events
     */
    setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
        setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
            var _3;
            const now = new Date();
            const users = yield prisma.user.findMany({
                where: {
                    remindersEnabled: true
                }
            });
            console.log(`🕒 Running reminders to ${users.length} users`);
            for (const user of users) {
                const userInfo = yield app.client.users.info({
                    user: user.slackId
                });
                const tz = (_3 = userInfo.user) === null || _3 === void 0 ? void 0 : _3.tz_offset; // the timezone offset in seconds
                assertVal(tz);
                let tzDate = new Date();
                tzDate.setHours(new Date().getUTCHours() + (tz / 3600));
                const tzHour = tzDate.getHours();
                const remindHour = Number.parseInt(user.reminder.split(":")[0]);
                console.log(`🕒 Checking ${user.slackId} at ${tzHour} against ${remindHour}`);
                if (tzHour != remindHour) {
                    continue;
                }
                // Check if the user already hacked today
                const sessions = yield prisma.session.findMany({
                    where: {
                        userId: user.slackId,
                        createdAt: (new Date()).toDateString()
                    }
                });
                if (sessions.length > 0) {
                    continue;
                }
                yield app.client.chat.postMessage({
                    channel: user.slackId,
                    text: `🕒 It's ${tzHour} o'clock! Time for your daily hack hour! Run \`/hack\` to get started.`
                });
            }
            console.log('🎈 Running event updates');
            for (const event in events) {
                events[event].hourlyCheck();
            }
        }), Constants.HOUR_MS);
    }), Constants.HOUR_MS - Date.now() % Constants.HOUR_MS);
    // App    
    if (!process.env.PORT) {
        throw new Error('❌ PORT is not defined in the environment');
    }
    app.start(process.env.PORT);
    console.log('⏳ And the hour begins...');
}))();
