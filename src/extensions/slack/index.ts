import { app, Slack } from "../../lib/bolt.js";
import { Actions, Commands, Constants, Environment } from "../../lib/constants.js";
import { prisma, uid } from "../../lib/prisma.js";
import { emitter } from "../../lib/emitter.js";

import { t, t_fetch, t_format } from "../../lib/templates.js";
import { reactOnContent } from "./lib/emoji.js";
import { updateController, updateTopLevel, informUser, informUserBlocks } from "./lib/lib.js";

import { Session } from "@prisma/client";

import "./functions/pause.js";
import "./functions/cancel.js";
import "./functions/extend.js";
import "./functions/goals.js";
import "./functions/stats.js"
import { assertVal } from "../../lib/assert.js";
import { Hack } from "./views/hack.js";
import { firstTime } from "../arcade/watchers/hackhour.js";

/*
Session Creation
*/

type CommandHandler = Parameters<Parameters<typeof Slack.command>[1]>[0];

const log = async (message: string) => {
    await Slack.chat.postMessage({
        channel: Environment.INTERNAL_CHANNEL,
        text: message
    });
    console.log(message);
}

const hack = async ({ command }: CommandHandler) => {
    try {
        const slackId = command.user_id;

        let slackUser = await prisma.slackUser.upsert(
            {
                where: {
                    slackId
                },
                create: {
                    slackId,
                    user: {
                        create: {
                            id: uid(),
                            lifetimeMinutes: 0,
                            apiKey: uid(),
                            goals: {
                                create: {
                                    id: uid(),
                                    name: "No Goal",
                                    default: true,
                                    metadata: {
                                        // TODO
                                    }
                                }
                            },
                            metadata: {
                                airtable: undefined,
                                ships: {},
                                firstTime: true
                            }
                        }
                    },
                },
                update: {},
                include: {
                    user: {
                        include: {
                            sessions: {
                                where: {
                                    completed: false,
                                    cancelled: false
                                }
                            }
                        }
                    }
                }
            }
        );

        if (slackUser.user.metadata.firstTime && Environment.ARCADE) {
            // TODO: remove arcade dependency & check if there are entities/subrountines listening to first time users
            if (await firstTime(slackUser.user)) {
                return;
            }
        }

        if (slackUser.user.sessions.length > 0) {
            await informUser(slackId, t('error.already_hacking', {}), command.channel_id);

            return;
        }

        if (!command.text || command.text.length == 0) {
            await informUserBlocks(slackId, Hack.hack(slackUser.user.metadata.firstTime), command.channel_id);

            return;
        }

        const topLevel = await Slack.chat.postMessage({
            channel: Environment.MAIN_CHANNEL,
            text: "Initalizing... :spin-loading:" // Leave it empty, for initialization
        });

        // Create a controller message in the thread
        const controller = await Slack.chat.postMessage({
            channel: Environment.MAIN_CHANNEL,
            thread_ts: topLevel!.ts,
            text: "Initalizing... :spin-loading:" // Leave it empty, for initialization
        })

        if (!controller || !controller.ts) {
            throw new Error(`Failed to create a message for ${slackId}`)
        }

        const session = await prisma.session.create({
            data: {
                id: uid(),

                user: {
                    connect: {
                        id: slackUser.userId
                    }
                },

                messageTs: assertVal(topLevel!.ts),
                controlTs: controller.ts,

                time: 60,
                elapsed: 0,

                completed: false,
                cancelled: false,
                paused: false,

                elapsedSincePause: 0,

                metadata: {
                    work: command.text,
                    slack: {
                        template: slackUser.user.metadata.firstTime ? t_fetch('firstTime.toplevel.main') : t_fetch('toplevel.main'),
                        controllerTemplate: slackUser.user.metadata.firstTime ? t_fetch('onboarding.encouragement') : t_fetch('encouragement')
                    },
                    firstTime: slackUser.user.metadata.firstTime ? {
                        step: 0
                    } : undefined,
                    banked: false
                },

                goal: {
                    connect: {
                        id: (await prisma.goal.findFirstOrThrow({
                            where: {
                                default: true,
                                userId: slackUser.userId
                            }
                        })).id
                    }
                }
            }
        });

        await updateController(session);
        await updateTopLevel(session);

        emitter.emit('start', session);

        await reactOnContent({
            content: command.text,
            channel: Environment.MAIN_CHANNEL,
            ts: assertVal(topLevel!.ts)
        });
    } catch (error) {
        emitter.emit('error', error);
    }
};

Slack.command(Commands.HACK, hack);
Slack.command(Commands.HOUR, hack);
Slack.command(Commands.ARCADE, hack);

Slack.action(Actions.HACK, async ({ ack, body, respond }) => {
    await ack();
    await respond({
        delete_original: true
    });

    const slackId = body.user.id;

    let text = '';
    try {
        text = (body as any).state.values.hack.hack.value;
    } catch (error) {
        text = ''
    }

    const channel = body.channel!.id!;

    let slackUser = await prisma.slackUser.upsert(
        {
            where: {
                slackId
            },
            create: {
                slackId,
                user: {
                    create: {
                        id: uid(),
                        lifetimeMinutes: 0,
                        apiKey: uid(),
                        goals: {
                            create: {
                                id: uid(),
                                name: "No Goal",
                                default: true,
                                metadata: {
                                    // TODO
                                }
                            }
                        },
                        metadata: {
                            firstTime: true,
                            airtable: undefined,
                            ships: {}
                        }
                    }
                },
            },
            update: {},
            include: {
                user: {
                    select: {
                        metadata: true,
                        sessions: {
                            where: {
                                completed: false,
                                cancelled: false
                            }
                        }
                    }
                }
            }
        }
    );

    if (slackUser.user.sessions.length > 0) {
        await informUser(slackId, t('error.already_hacking', {}), channel);
        return;
    }

    if (!text || text.length == 0) {
        await informUser(slackId, t('error.empty_text', {}), channel);

        return;
    }

    const topLevel = await Slack.chat.postMessage({
        channel: Environment.MAIN_CHANNEL,
        text: "Initalizing... :spin-loading:" // Leave it empty, for initialization
    });

    // Create a controller message in the thread
    const controller = await Slack.chat.postMessage({
        channel: Environment.MAIN_CHANNEL,
        thread_ts: topLevel!.ts,
        text: "Initalizing... :spin-loading:" // Leave it empty, for initialization
    })

    if (!controller || !controller.ts) {
        throw new Error(`Failed to create a message for ${slackId}`)
    }

    const session = await prisma.session.create({
        data: {
            id: uid(),

            user: {
                connect: {
                    id: slackUser.userId
                }
            },

            messageTs: assertVal(topLevel!.ts),
            controlTs: controller.ts,

            time: 60,
            elapsed: 0,

            completed: false,
            cancelled: false,
            paused: false,

            elapsedSincePause: 0,

            metadata: {
                work: text,
                slack: {
                    template: t_fetch('toplevel.main'),
                    controllerTemplate: slackUser.user.metadata.firstTime ? t_fetch('onboarding.encouragement') : t_fetch('encouragement')
                },
                firstTime: slackUser.user.metadata.firstTime ? {
                    step: 0
                } : undefined,
                banked: false
            },

            goal: {
                connect: {
                    id: (await prisma.goal.findFirstOrThrow({
                        where: {
                            default: true,
                            userId: slackUser.userId
                        }
                    })).id
                }
            }
        }
    });

    await updateController(session);
    await updateTopLevel(session);

    emitter.emit('start', session);

    await reactOnContent({
        content: text,
        channel: Environment.MAIN_CHANNEL,
        ts: assertVal(topLevel!.ts)
    });
});

/*
Minute tracker
*/
emitter.on('sessionUpdate', async (session: Session) => {
    try {
        // Check if the prisma user has a slack component
        const slackUser = await prisma.slackUser.findUnique({
            where: {
                userId: session.userId
            }
        });

        if (!slackUser) {
            //            throw new Error(`Missing slack component of ${session.userId}`)
            return;
        }

        // Check if the message exists
        const message = await app.client.conversations.history({
            channel: Environment.MAIN_CHANNEL,
            latest: session.messageTs,
            limit: 1
        });

        if (message.messages == undefined || message.messages.length == 0) {
            console.log(`❌ Session ${session.messageTs} does not exist`);

            // Remove the session
            await prisma.session.deleteMany({
                where: {
                    messageTs: session.messageTs
                }
            });

            return;
        }

        if (session.paused) {
            await updateController(session);

            return;
        } else if ((session.time - session.elapsed) % 15 == 0 && session.elapsed > 0 && !session.metadata.firstTime) {
            // Send a reminder every 15 minutes
            await Slack.chat.postMessage({
                thread_ts: session.messageTs,
                user: slackUser.slackId,
                channel: Environment.MAIN_CHANNEL,
                text: t(`update`, {
                    slackId: slackUser.slackId,
                    minutes: session.time - session.elapsed
                })
            });
        }

        await updateController(session);
        await updateTopLevel(session);
    } catch (error) {
        emitter.emit('error', error);
    }
});

emitter.on('complete', async (session: Session) => {
    const slackUser = await prisma.slackUser.findUnique({
        where: {
            userId: session.userId
        }
    });

    if (!slackUser) {
        // Skip
        return;
    }

    await Slack.chat.postMessage({
        thread_ts: session.messageTs,
        channel: Environment.MAIN_CHANNEL,
        text: session.metadata.firstTime ? t('onboarding.complete', {
            slackId: slackUser.slackId
        }) : t('complete', {
            slackId: slackUser.slackId
        }),
        blocks: [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": session.metadata.firstTime ? t('onboarding.complete', {
                        slackId: slackUser.slackId
                    }) : t('complete', {
                        slackId: slackUser.slackId
                    })
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View Stats"
                    },
                    "action_id": Actions.VIEW_STATS,
                }
            }
        ]
    });

    await Slack.reactions.add({
        name: "tada",
        channel: Environment.MAIN_CHANNEL,
        timestamp: session.messageTs
    });

    // Increment minutes in goals
    await prisma.goal.update({
        where: {
            id: session.goalId as string
        },
        data: {
            minutes: {
                increment: session.elapsed
            }
        }
    });

    await updateController(session);
    await updateTopLevel(session);

    const replies = await app.client.conversations.replies({
        channel: Environment.MAIN_CHANNEL,
        ts: session.messageTs
    });

    const userReplies = replies.messages?.filter(m => m.user == slackUser.slackId);
    if (userReplies && userReplies.length > 0) {
        await prisma.session.update({
            where: {
                id: session.id
            },
            data: {
                evidence: true
            }
        });
    }
});

emitter.on('cancel', async (session: Session) => {
    const slackUser = await prisma.slackUser.findUnique({
        where: {
            userId: session.userId
        }
    });

    if (!slackUser) {
        // Skip
        return;
    }

    await Slack.chat.postMessage({
        thread_ts: session.messageTs,
        channel: Environment.MAIN_CHANNEL,
        text: session.metadata.firstTime ? t('onboarding.complete', {
            slackId: slackUser.slackId,
            minutes: session.elapsed
        }) : t('cancel', {
            slackId: slackUser.slackId,
            minutes: session.elapsed
        }),        
        // text: t_format('hey <@${slackId}>! you cancelled your hour, but you still have ${minutes} minutes recorded - make sure to post something to count those!', {
        //     slackId: slackUser.slackId,
        //     minutes: session.elapsed
        // }),
        blocks: [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": session.metadata.firstTime ? t('onboarding.complete', {
                        slackId: slackUser.slackId,
                        minutes: session.elapsed
                    }) : t('cancel', {
                        slackId: slackUser.slackId,
                        minutes: session.elapsed
                    })
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View Stats"
                    },
                    "action_id": Actions.VIEW_STATS,
                }
            }
        ]
    });

    // Increment minutes in goals
    await prisma.goal.update({
        where: {
            id: session.goalId as string
        },
        data: {
            minutes: {
                increment: session.elapsed
            }
        }
    });

    await Slack.reactions.add({
        name: "exit",
        channel: Environment.MAIN_CHANNEL,
        timestamp: session.messageTs
    });

    await updateController(session);
    await updateTopLevel(session);
});

emitter.on('pause', async (session: Session) => {
    await updateController(session);
    await updateTopLevel(session);
});

emitter.on('resume', async (session: Session) => {
    await updateController(session);
    await updateTopLevel(session);
});

emitter.on('init', async () => {
    if (Environment.PROD) {
        const message = t('init', {
            repo: "https://github.com/hackclub/hack-hour",
            main: Environment.MAIN_CHANNEL
        });

        let releaseVersion = process.env.HEROKU_RELEASE_VERSION || 'vDev';

        let buildDesc = process.env.HEROKU_BUILD_DESCRIPTION;
        if (buildDesc) {
            buildDesc = buildDesc.replace('Deploy ', '');
        } else {
            buildDesc = 'Development';
        }

        await Slack.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: Environment.INTERNAL_CHANNEL,
            text: `_yawnns_`,
        });

        await Slack.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: 'C0P5NE354',
            text: `_${message}_`,
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `_${message}_\n\n<https://github.com/hackclub/hack-hour|Repository>`
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": `Hack Hour 3 - Release ${releaseVersion}-${buildDesc}`
                        }
                    ]
                }
            ],
        });
    }
});

emitter.on('error', async (error) => {
    try {
        if (!error) {
            throw new Error('No error provided!');
        }
        await Slack.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: process.env.LOG_CHANNEL || 'C0P5NE354',
            text: `<!subteam^${process.env.DEV_USERGROUP}> \`${error.message}\`\n\`\`\`${error.stack}\`\`\``,
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});

emitter.on('debug', async (message) => {
    try {
        if (!message) {
            throw new Error('No message provided!');
        }
        await Slack.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: process.env.LOG_CHANNEL || 'C0P5NE354',
            text: `${message}`,
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});