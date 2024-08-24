import { prisma, uid } from "../../lib/prisma.js";
import { Slack, app, express } from "../../lib/bolt.js";
import { AirtableAPI } from "../../lib/airtable.js";

import rateLimit from "express-rate-limit";
import { emitter } from "../../lib/emitter.js";
import { Session as SessionType } from "@prisma/client";
import { t, t_fetch } from "../../lib/templates.js";
import { assertVal } from "../../lib/assert.js";
import { Environment } from "../../lib/constants.js";
import { reactOnContent } from "../slack/lib/emoji.js";
import { updateController, updateTopLevel } from "../slack/lib/lib.js";
import { Session } from "../../lib/corelib.js";
import { scryptSync } from "crypto";

const readLimit = rateLimit({
    // 10 req per minute
    windowMs: 60 * 1000,
    limit: 10,
    skipFailedRequests: true,
    message: {
        ok: false,
        error: 'Rate limit exceeded - 10 requests per minute allowed.',
    },
});

const limiter = rateLimit({
    // 16 req per hour
    windowMs: 60 * 60 * 1000,
    limit: 16,
    message: {
        ok: false,
        error: 'Rate limit exceeded - 16 requests per hour allowed.',
    },
});

// Extract authorization header
declare global {
    namespace Express {
        interface Request {
            apiKey?: string;
        }
    }
}

// const endpoints: string[] = [];

// AirtableAPI.API.getAllActive().then(records => {
//     records.forEach(record => {
//         endpoints.push(record.fields['Endpoint']);
//     });
// })

// const postEndpoints = async (session: SessionType) => {
//     const user = await prisma.slackUser.findUnique({
//         where: {
//             userId: session.userId,
//         },
//     });

//     for (const endpoint of endpoints) {
//         await fetch(endpoint, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({
//                 slackId: user?.slackId,
//                 userId: session.userId,
//                 sessionId: session.id,
//                 sessionTs: session.messageTs,
//                 createdAt: session.createdAt,
//                 endedAt: new Date(),
//                 time: session.time,
//                 elapsed: session.elapsed,
//                 completed: session.completed,
//                 cancelled: session.cancelled,
//                 paused: session.paused,
//                 metadata: session.metadata,
//             }),
//         });
//     }
// }

// emitter.on('complete', async (session: SessionType) => {
//     await postEndpoints(session);
// });

// emitter.on('cancel', async (session: SessionType) => {
//     await postEndpoints(session);
// });

express.set('trust proxy', true)

express.use((req, res, next) => {
    const authHeader = req.headers['authorization'];

    console.log(`[API] User agent: ${req.headers['user-agent']}`)

    if (authHeader) {
        const apiKey = authHeader.split(' ')[1];
        req.apiKey = apiKey;
    }
    next();
});

express.get('/', async (req, res) => {
    await res.redirect("https://github.com/hackclub/hack-hour");
});

express.get('/ping', async (req, res) => {
    await res.send('pong');
})

express.get('/status', async (req, res) => {
    let result = {
        activeSessions: -1,
        airtableConnected: false,
        slackConnected: false,
    }

    try {
        await Promise.all([
            prisma.session.aggregate({ where: { completed: false, cancelled: false }, _count: true }).then(r => result['activeSessions'] = r._count),
            AirtableAPI.User.lookupBySlack('U04QD71QWS0').then(r => result['airtableConnected'] = r?.fields['Slack ID'] == 'U04QD71QWS0'),
            app.client.auth.test().then(r => result['slackConnected'] = r?.ok),
        ]);
        await res.status(200).send(result);
    } catch (e) {
        await res.status(500).send(result);
    }

})

interface ResponseBase {
    ok: boolean;
    data?: any;
    error?: string;
}

interface ResponseOk extends ResponseBase {
    ok: true;
    data: any;
}

interface ResponseError extends ResponseBase {
    ok: false;
    error: string;
}

type Response = ResponseOk | ResponseError;

/**
 * Get the remaining time for the current session
 * deprecated
 */
express.get('/api/clock/:slackId', readLimit, async (req, res) => {
    try {
    const slackId = req.params.slackId;
    const slackUser = await prisma.slackUser.findFirst({
        where: {
            slackId: slackId,
        },
    });

    if (!slackUser) {
        return res.status(404).send({
            ok: false,
            error: 'User not found',
        });
    }

    const result = await prisma.session.findFirst({
        where: {
            userId: slackUser.userId,
            completed: false,
            cancelled: false,
            paused: false,
        },
    });

    if (result) {
        const startTime = result.createdAt.getTime();
        const duration = result.time * 60 * 1000; // convert from minutes to milliseconds
        const currTime = new Date().getTime();
        const elapsedTime = currTime - startTime;
        const leftTime = duration - elapsedTime;
        return res.status(200).send(leftTime.toString());
    } else {
        return res.status(200).send((-1).toString());
    }
} catch (error) {
    console.error(`[API] Error in /api/clock/:slackId: ${error}`);
}
});

/**
 * Get the latest session
 */
express.get('/api/session/:slackId', readLimit, async (req, res) => {
    try {
    if (!req.apiKey) {
        return res.status(401).send({
            ok: false,
            error: 'Unauthorized',
        });
    }

    const authorizedUser = await prisma.slackUser.findFirst({
        where: {
            user: {
                apiKey: scryptSync(req.apiKey, 'salt', 64).toString('hex'),
            },
        },
    });

    if (!authorizedUser) {
        return res.status(401).send({
            ok: false,
            error: 'Unauthorized',
        });
    }

    const slackUser = await prisma.slackUser.findFirst({
        where: {
            slackId: req.params.slackId,
        },
    });

    if (!slackUser) {
        return res.status(404).send({
            ok: false,
            error: 'User not found',
        });
    }

    // Grab the latest session
    const result = await prisma.session.findFirst({
        where: {
            userId: req.params.userId,
        },
        orderBy: {
            createdAt: 'desc',
        },
        include: {
            goal: {
                select: {
                    name: true,
                }
            },
        },
    });

    if (result) {
        const now = new Date();
        const endTime = new Date(now.getTime() + (result.time - result.elapsed) * 60 * 1000);

        endTime.setMilliseconds(0);
        endTime.setSeconds(0);

        const response = {
            ok: true,
            data: {
                id: slackUser.slackId,
                createdAt: result.createdAt,
                time: result.time,
                elapsed: result.elapsed,
                remaining: result.time - result.elapsed,
                endTime: endTime,
                paused: result.paused,
                completed: result.completed || result.cancelled,
                goal: result.goal.name,
                work: result.metadata?.work,
                messageTs: result.messageTs,
            },
        }

        return res.status(200).send(response);
    } else {
        const response: Response = {
            ok: false,
            error: 'No active session found',
        }

        return res.status(200).send(response);
    }
} catch (error) {
    console.error(`[API] Error in /api/session/:slackId: ${error}`);
}
});

/**
 * Get stats for a user, including number of sessions and number of hours
 */
express.get('/api/stats/:slackId', readLimit, async (req, res) => {
    try {
    if (!req.apiKey) {
        return res.status(401).send({
            ok: false,
            error: 'Unauthorized',
        });
    }

    const slackUser = await prisma.slackUser.findFirst({
        where: {
            user: {
                apiKey: scryptSync(req.apiKey, 'salt', 64).toString('hex'),
            },
        },
    });

    if (!slackUser) {
        return res.status(404).send({
            ok: false,
            error: 'User not found',
        });
    }

    const result = await prisma.session.aggregate({
        where: {
            userId: slackUser.userId,
            completed: true,
        },
        _sum: {
            elapsed: true,
        },
        _count: true,
    });

    if (result) {
        const response: Response = {
            ok: true,
            data: {
                sessions: result._count,
                total: result._sum.elapsed,
            },
        }

        return res.status(200).send(response);
    } else {
        const response: Response = {
            ok: true,
            data: {
                sessions: 0,
                total: 0,
            },
        }

        return res.status(200).send(response);
    }
} catch (error) {
    console.error(`[API] Error in /api/stats/:slackId: ${error}`);
}
});

/**
 * Get the goals of a user
 */
express.get('/api/goals/:slackId', readLimit, async (req, res) => {
    try {
    if (!req.apiKey) {
        return res.status(401).send({
            ok: false,
            error: 'Unauthorized',
        });
    }

    const slackUser = await prisma.slackUser.findFirst({
        where: {
            user: {
                apiKey: scryptSync(req.apiKey, 'salt', 64).toString('hex'),
            },
        },
    });

    if (!slackUser) {
        return res.status(404).send({
            ok: false,
            error: 'User not found',
        });
    }

    const result = await prisma.goal.findMany({
        where: {
            userId: slackUser.userId,
        },
        select: {
            name: true,
            minutes: true,
        },
    });

    const response: Response = {
        ok: true,
        data: result.map(r => {
            return {
                name: r.name,
                minutes: r.minutes
            }
        }),
    }

    return res.status(200).send(response);
} catch (error) {
    console.error(`[API] Error in /api/goals/:slackId: ${error}`);
}
});

/**
 * Get the user's session history
 */
express.get('/api/history/:slackId', readLimit, async (req, res) => {
    try {
    if (!req.apiKey) {
        return res.status(401).send({
            ok: false,
            error: 'Unauthorized',
        });
    }

    const slackUser = await prisma.slackUser.findFirst({
        where: {
            user: {
                apiKey: scryptSync(req.apiKey, 'salt', 64).toString('hex'),
            },
        },
        include: {
            user: {
                select: {
                    sessions: {
                        include: {
                            goal: {
                                select: {
                                    name: true,
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!slackUser) {
        return res.status(404).send({
            ok: false,
            error: 'User not found',
        });
    }

    const response: Response = {
        ok: true,
        data: slackUser.user.sessions.map(r => {
            return {
                createdAt: r.createdAt,
                time: r.time,
                elapsed: r.elapsed,

                goal: r.goal.name,
                ended: r.completed || r.cancelled,

                work: r.metadata?.work,
            }
        })
    }

    return res.status(200).send(response);
} catch (error) {
    console.error(`[API] Error in /api/history/:slackId: ${error}`);
}
});

/*
Write API
*/

/**
 * Start a session
 */
express.post('/api/start/:slackId', limiter, async (req, res) => {
    try {

    if (!req.apiKey) {
        return res.status(401).send({
            ok: false,
            error: 'Unauthorized - Missing API key',
        });
    }

    const apiKey = scryptSync(req.apiKey, 'salt', 64).toString('hex');

    const user = await prisma.user.findUnique({
        where: {
            apiKey
        },
        include: {
            sessions: {
                where: {
                    completed: false,
                    cancelled: false,
                }
            },
            slackUser: {
                select: {
                    slackId: true
                }
            }
        }
    });

    if (!user || !user.slackUser?.slackId) {
        return res.status(401).send({
            ok: false,
            error: 'Unauthorized',
        });
    }

    if (user.sessions.length > 0) {
        return res.status(400).send({
            ok: false,
            error: 'You already have an active session',
        });
    }

    const work = req.body.work;

    if (!work || typeof work !== 'string' || work.length === 0) {
        return res.status(400).send({
            ok: false,
            error: 'Missing or invalid work parameter',
        });
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
        throw new Error(`Failed to create a message via. API for ${user.slackUser?.slackId}`)
    }

    const session = await prisma.session.create({
        data: {
            id: uid(),

            user: {
                connect: {
                    id: user.id
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
                work,
                slack: {
                    template: t_fetch('toplevel.main'),
                    controllerTemplate: t_fetch('encouragement'),
                },
                banked: false
            },

            goal: {
                connect: {
                    id: (await prisma.goal.findFirstOrThrow({
                        where: {
                            default: true,
                            userId: user.id
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
        content: work,
        channel: Environment.MAIN_CHANNEL,
        ts: assertVal(topLevel!.ts)
    });

    return res.status(200).send({
        ok: true,
        data: {
            id: session.id,
            slackId: user.slackUser?.slackId,
            createdAt: session.createdAt,
        },
    });

} catch (error) {
    console.error(`[API] Error in /api/start/:slackId: ${error}`);
}
});

/**
 * Cancel a session
 */
express.post('/api/cancel/:slackId', limiter, async (req, res) => {
    try {
        if (!req.apiKey) {
            return res.status(401).send({
                ok: false,
                error: 'Unauthorized',
            });
        }

        const apiKey = scryptSync(req.apiKey, 'salt', 64).toString('hex');

        const session = await prisma.session.findFirst({
            where: {
                user: {
                    apiKey
                },
                completed: false,
                cancelled: false,
            },
            include: {
                user: {
                    select: {
                        slackUser: {
                            select: {
                                slackId: true
                            }
                        }
                    }
                }
            }
        });

        if (!session || !session.user.slackUser?.slackId) {
            return res.status(401).send({
                ok: false,
                error: 'Invalid user or no active session found',
            });
        }

        if (session.metadata.firstTime) {
            return res.status(400).send({
                ok: false,
                error: 'First time sessions cannot be cancelled',
            });
        }

        await Session.cancel(session);

        return res.status(200).send({
            ok: true,
            data: {
                id: session.id,
                slackId: session.user.slackUser?.slackId,
                createdAt: session.createdAt,
            },
        });
    } catch (error) {
        console.error(`[API] Error in /api/cancel/:slackId: ${error}`);
    }
});

/**
 * Pause a session
 */
express.post('/api/pause/:slackId', limiter, async (req, res) => {
    try {
        if (!req.apiKey) {
            return res.status(401).send({
                ok: false,
                error: 'Unauthorized',
            });
        }

        const apiKey = scryptSync(req.apiKey, 'salt', 64).toString('hex');

        const session = await prisma.session.findFirst({
            where: {
                user: {
                    apiKey
                },
                completed: false,
                cancelled: false,
            },
            include: {
                user: {
                    select: {
                        slackUser: {
                            select: {
                                slackId: true
                            }
                        }
                    }
                }
            }
        });

        if (!session || !session.user.slackUser?.slackId) {
            return res.status(401).send({
                ok: false,
                error: 'Invalid user or no active session found',
            });
        }

        if (session.metadata.firstTime) {
            return res.status(400).send({
                ok: false,
                error: 'First time sessions cannot be paused',
            });
        }

        const updatedSession = await Session.pause(session);

        return res.status(200).send({
            ok: true,
            data: {
                id: session.id,
                slackId: session.user.slackUser?.slackId,
                createdAt: session.createdAt,
                paused: updatedSession.paused,
            },
        });
    } catch (error) {
        console.error(`[API] Error in /api/pause/:slackId: ${error}`);
    }
});