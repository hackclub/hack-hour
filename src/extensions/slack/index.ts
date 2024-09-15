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
import "./functions/stats.js";
import "./functions/api.js";
import "./functions/showcase.js";

import { assertVal } from "../../lib/assert.js";
import { Hack } from "./views/hack.js";
import { firstTime } from "../arcade/watchers/hackhour.js";
import { AirtableAPI } from "../../lib/airtable.js";
import { KnownBlock } from "@slack/bolt";
import { lock } from "../../lib/lock.js";

/*
Session Creation
*/

type CommandHandler = Parameters<Parameters<typeof Slack.command>[1]>[0];

const log = async (message: string) => {
    await Slack.chat.postMessage({
        channel: Environment.INTERNAL_CHANNEL,
        text: message
    });
    console.log('[Slack Log]', message);
}

const hack = async ({ command }: CommandHandler) => {
    const slackId = command.user_id;

    await lock.acquire('hack' + slackId, async () => {
        try {
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

            if (slackUser.user.sessions.length > 0) {
                const url = await Slack.chat.getPermalink({
                    channel: Environment.MAIN_CHANNEL,
                    message_ts: slackUser.user.sessions[0].messageTs
                });

                await informUser(slackId, t('error.already_hacking', {
                    url: url?.permalink
                }), command.channel_id);

                return;
            }


            if (slackUser.user.metadata.firstTime && Environment.ARCADE) {
                // TODO: remove arcade dependency & check if there are entities/subrountines listening to first time users
                if (await firstTime(slackUser.user)) { // firstTime returns true if the user is existing, meaning I can redirect them through the arcadius flow
                    const airtableUser = await AirtableAPI.User.lookupBySlack(slackId);

                    if (airtableUser) {
                        await informUserBlocks(slackId, [
                            {
                                "type": "section",
                                "text": {
                                    "type": "mrkdwn",
                                    "text": /*session.metadata.firstTime ? t('onboarding.complete', {
                            slackId: slackUser.slackId
                        }) : */t('firstTime.existing_user')
                                },
                                "accessory": {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "continue..."
                                    },
                                    "url": `https://hackclub.slack.com/archives/${airtableUser?.fields['dmChannel']}`,
                                    "action_id": Actions.EXISTING_USER_FIRST_TIME,
                                }
                            }
                        ], command.channel_id);
                    }

                    return;
                }
            }

            // Check if the user is a full user or a MCG
            const slackUserInfo = await Slack.users.info({
                user: slackId
            });

            if (!slackUserInfo.user) {
                throw new Error(`Failed to fetch user info for ${slackId}`);
            }

            if (!slackUser.user.metadata.firstTime && slackUserInfo.user.is_restricted) {
                const airtable = await AirtableAPI.User.lookupBySlack(slackId);

                await informUserBlocks(slackId, [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": t('error.not_full_user')
                        },
                        "accessory": {
                            "type": "button",
                            "text": {
                                "text": "Go to Tutorial",
                                "type": "plain_text",
                            },
                            "url": `https://hackclub.slack.com/archives/${airtable?.fields['dmChannel']}`,
                        }
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": "Make sure you check your dms with arcadius and me & click the upgrade button if you see it! If you need help, ask <@UDK5M9Y13> in <#C077TSWKER0>"
                            }
                        ]
                    }
                ] as KnownBlock[], command.channel_id);

                return;
            }

            if (!command.text || command.text.length == 0) {
                await informUserBlocks(slackId, Hack.hack(slackUser.user.metadata.firstTime), command.channel_id);

                return;
            }

            const airtableUser = await AirtableAPI.User.lookupBySlack(slackId);

            if (airtableUser?.fields['Scrapbook'].length == 0 && airtableUser?.fields['Sessions'].length >= 50) {
                await informUser(slackId, t('error.no_scrapbook'), command.channel_id);

                return;
            }

            const topLevel = await Slack.chat.postMessage({
                channel: Environment.MAIN_CHANNEL,
                text: t('loading'),
            });

            // Create a controller message in the thread
            const controller = await Slack.chat.postMessage({
                channel: Environment.MAIN_CHANNEL,
                thread_ts: topLevel!.ts,
                text: t('loading')
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
                            controllerTemplate: slackUser.user.metadata.firstTime ? '' : t_fetch('encouragement'),
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
            emitter.emit('error', { error });
        }
    })
        .catch((error) => {
            console.error('[Error]', error);
        });
};

Slack.command(Commands.HACK, hack);
Slack.command(Commands.HOUR, hack);
Slack.command(Commands.ARCADE, hack);

Slack.action(Actions.HACK, async ({ body, respond }) => {
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
        const sesh = await prisma.session.findFirst({
            where: {
                user: {
                    slackUser: {
                        slackId: slackId
                    }
                },
                completed: false,
                cancelled: false
            }
        });

        const url = await Slack.chat.getPermalink({
            channel: Environment.MAIN_CHANNEL,
            message_ts: sesh!.messageTs
        });

        await informUser(slackId, t('error.already_hacking', {
            url: url?.permalink
        }), channel);
        return;
    }

    if (!text || text.length == 0) {
        await informUser(slackId, t('error.empty_text'), channel);

        return;
    }

    const topLevel = await Slack.chat.postMessage({
        channel: Environment.MAIN_CHANNEL,
        text: t('loading'),
    });

    // Create a controller message in the thread
    const controller = await Slack.chat.postMessage({
        channel: Environment.MAIN_CHANNEL,
        thread_ts: topLevel!.ts,
        text: t('loading')
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

            messageTs: await assertVal(topLevel!.ts),
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
                    template: slackUser.user.metadata.firstTime ? t_fetch('firstTime.toplevel.main') : t_fetch('toplevel.main'),
                    controllerTemplate: slackUser.user.metadata.firstTime ? '' : t_fetch('encouragement'),
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
        ts: await assertVal(topLevel!.ts)
    });
});

/*
Minute tracker
*/
emitter.on('sessionUpdate', async (update: {
    updatedSession: Session,
    updateSlack: boolean
}) => {
    try {
        const { updatedSession: session, updateSlack } = update;

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
        // if (updateSlack) {
        //     const message = await app.client.conversations.history({
        //         channel: Environment.MAIN_CHANNEL,
        //         latest: session.messageTs,
        //         limit: 1
        //     });

        //     if (message.messages == undefined || message.messages.length == 0) {
        //         console.log(`❌ Session ${session.messageTs} does not exist`);

        //         // Remove the session
        //         await prisma.session.deleteMany({
        //             where: {
        //                 messageTs: session.messageTs
        //             }
        //         });

        //         return;
        //     }
        // }

        if (session.paused) {
            if (updateSlack) {
                await updateController(session);
            }

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

        if (updateSlack) {
            await updateController(session);
            await updateTopLevel(session);
        }
    } catch (error) {
        emitter.emit('error', { error });
        console.error(error);
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

    if (!session.metadata.firstTime) {
        await Slack.chat.postMessage({
            thread_ts: session.messageTs,
            channel: Environment.MAIN_CHANNEL,
            text: t('complete', {
                slackId: slackUser.slackId
            }),
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": t('complete', {
                            slackId: slackUser.slackId
                        })
                    }
                }
            ]
        });
    }

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

    if (!session.metadata.firstTime) {
        await Slack.chat.postMessage({
            thread_ts: session.messageTs,
            channel: Environment.MAIN_CHANNEL,
            text: /*session.metadata.firstTime ? t('onboarding.complete', {
                slackId: slackUser.slackId,
                minutes: session.elapsed
            }) :*/t('cancel', {
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
                        "text": /*session.metadata.firstTime ? t('onboarding.complete', {
                            slackId: slackUser.slackId,
                            minutes: session.elapsed
                        }) :*/ t('cancel', {
                            slackId: slackUser.slackId,
                            minutes: session.elapsed
                        })
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Open Showcase"
                        },
                        "action_id": Actions.OPEN_SHOWCASE,
                    }
                }
            ]
        });
    }

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
    console.log('[Slack Init] Slack initialized!');

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
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `> _${t('init', {
                            main: Environment.MAIN_CHANNEL
                        })}_`
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": `Release ${releaseVersion}-${buildDesc}\n${new Date().toString()}`
                        }
                    ]
                }
            ]
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

emitter.on('error', async (errorRef) => {
    try {
        const error = errorRef.error;
        console.error('[Error]', error)

        return;

        if (!error) {
            throw new Error('No error provided!');
        }

        await Slack.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: process.env.LOG_CHANNEL || 'C0P5NE354',
            text: `<!subteam^${process.env.DEV_USERGROUP}> \`${error.message}\`\n\`\`\`${error.stack}\`\`\``,
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `<!subteam^${process.env.DEV_USERGROUP}>\n> _Encountered an error: \`${error.message}\`_`
                    }
                },
                {
                    "type": "divider",
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `\`\`\`${error.stack}\`\`\``
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": `${new Date().toString()}`
                        }
                    ]
                }
            ]
        });
    } catch (error) {
        console.error('[Error]', error)
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
        emitter.emit('error', { error });
    }
});


Slack.command('/shop', async ({ command, respond }) => {
try {
    const user = await prisma.user.findFirst({
        where: {
            slackUser: {
                slackId: command.user_id
            }
        }
    });

    if (!user) {
        await respond({
            text: t('error.first_time')
        });

        return;
    }

    const recordId = user.metadata.airtable?.id;

    if (!recordId) {
        await respond({
            text: t('error.first_time')
        });

        return;
    }

    respond({
        response_type: 'ephemeral',
        text: `<${Environment.SHOP_URL}/arcade/${recordId}/shop/|Open the shop!>`
    });
} catch (e) {
    console.error(e);
}
});

Slack.command('/quickshop', async ({ command, respond }) => {
    try {
        const user = await prisma.user.findFirst({
            where: {
                slackUser: {
                    slackId: command.user_id
                }
            }
        });
    
        if (!user) {
            await respond({
                text: t('error.first_time')
            });
    
            return;
        }
    
        const recordId = user.metadata.airtable?.id;
    
        if (!recordId) {
            await respond({
                text: t('error.first_time')
            });
    
            return;
        }
    
        respond({
            response_type: 'ephemeral',
            text: `<${Environment.SHOP_URL}/arcade/${recordId}/shop/|Open the shop!>`
        });
    } catch (e) {
        console.error(e);
    }
    });
    
