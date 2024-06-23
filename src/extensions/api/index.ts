import { prisma } from "../../lib/prisma.js";
import { app, express } from "../../lib/bolt.js";
import { AirtableAPI } from "../../lib/airtable.js";

import rateLimit from "express-rate-limit";

const limiter = rateLimit({
    // 4 req per hour
    windowMs: 60 * 60 * 1000,
    max: 4,
    message: "You have exceeded the 4 requests in 1 hour limit!",
});

// Extract authorization header
declare global {
    namespace Express {
        interface Request {
            apiKey?: string;
        }
    }
}

express.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
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
            prisma.session.aggregate({where: {completed: false, cancelled: false}, _count: true }).then(r => result['activeSessions'] = r._count),
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
express.get('/api/clock/:slackId', async (req, res) => {
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
        const elapsedTime = currTime-startTime;
        const leftTime = duration-elapsedTime;
        return res.status(200).send(leftTime.toString());
    } else {
        return res.status(200).send((-1).toString());
    }
});

/**
 * Get the latest session
 */
express.get('/api/session/:slackId', async (req, res) => {
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

    // Grab the latest session
    const result = await prisma.session.findFirst({
        where: {
            userId: slackUser.userId,
        },
        orderBy: {
            createdAt: 'desc',
        },
        select: {
            createdAt: true,
            time: true,
            elapsed: true,
            completed: true,
            cancelled: true,
            paused: true,
            goal: {
                select: {
                    name: true,
                }
            }
        },
    });

    if (result) {
        let response: Response = {} as Response;

        if (result.completed || result.cancelled) {
            response = {
                ok: true,
                data: {
                    id: slackId,
                    createdAt: result.createdAt,
                    time: result.time,
                    elapsed: result.elapsed,
                    remaining: result.time - result.elapsed,
                    endTime: new Date(result.createdAt.getTime() + result.time*60*1000),
                    paused: result.paused,
                    goal: result.goal.name,
                    completed: true
                },
            }     
        } else {
            const now = new Date();
            const endTime = new Date(now.getTime() + result.time-result.elapsed);

            endTime.setMilliseconds(0);
            endTime.setSeconds(0);

            response = {
                ok: true,
                data: {
                    id: slackId,
                    createdAt: result.createdAt,
                    time: result.time,
                    elapsed: result.elapsed,
                    remaining: result.time - result.elapsed,
                    endTime: endTime,
                    paused: result.paused,
                    completed: false                    
                },
            }
        }

        return res.status(200).send(response);
    } else {
        const response: Response = {
            ok: false,
            error: 'No active session found',
        }

        return res.status(200).send(response);
    }
});

/**
 * Get stats for a user, including number of sessions and number of hours
 */
express.get('/api/stats/:slackId', async (req, res) => {
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
});

/**
 * Get the goals of a user
 */
express.get('/api/goals/:slackId', async (req, res) => {
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
});