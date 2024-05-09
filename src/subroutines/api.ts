import { Server } from "http";
import { prisma, express, minuteInterval } from "../app.js";
import { WebSocketServer } from 'ws';

express.app.get('/', async (req, res) => {
    await res.send('Hello World!');
});

express.app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const user = await prisma.user.findUnique({
        where: {
            slackId: userId,
        },
    });

    if (user) {
        const userGoals = await prisma.goals.findMany({
            where: {
                slackId: userId,
            },
        });

        const goalsPayload = userGoals.map((goal) => {
            return {
                id: goal.goalId,
                name: goal.goalName,
                minutes: goal.minutes,
            }
        });

        // Only send back non-sensitive information
        const userPayload = {
            totalMinutes: user.totalMinutes,
            selectedGoal: user.selectedGoal,
            event: user.eventId,
            goals: goalsPayload,
        }

        res.status(200).send(userPayload);
    } else {
        res.status(404).send('User not found');
    }
});

export const websocketManager = {
    startSession: (userId: string) => {},
    endSession: (userId: string, cancelled: boolean) => {},
};

// Create a WSS instance but don't start it yet
export function startWSS(server: Server) {
    const wss = new WebSocketServer({
        server: server,
    });

    // Get user id filter
    wss.on('connection', (ws) => {
        (ws as any).meta = {
            slackId: '',
        };

        ws.on('message', (message) => {
            console.log(`Received message => ${message}`);

            // Convert raw data to JSON
            const data = JSON.parse(String(message));

            if (data.type === 'subscribe') {
                // Attach metadata to the websocket connection
                (ws as any).meta.slackId = data.slackId;

                // Send a confirmation message
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    ok: true,
                }));
            }
        });
    });

    minuteInterval.attach(async () => {
        wss.clients.forEach(async (client) => {
            const slackId = (client as any).meta.slackId;

            if (slackId) {
                const results = await prisma.session.findMany({
                    where: {
                        userId: slackId,
                        completed: false,
                        cancelled: false,
                    },
                });
            
                if (results.length > 0) {
                    client.send(JSON.stringify({
                        type: 'session',
                        id: results[0].messageTs,
                        minutes: results[0].time - results[0].elapsed,
                    }));
                }
            }
        });
    });

    websocketManager.startSession = (userId: string) => {
        wss.clients.forEach((client) => {
            const slackId = (client as any).meta.slackId;
 
            if (slackId == userId) {
                client.send(JSON.stringify({
                    type: 'start',
                    slackId: userId,
                }));
            }
        });
    }

    websocketManager.endSession = (userId: string, cancelled: boolean) => {
        wss.clients.forEach((client) => {
            const slackId = (client as any).meta.slackId;
                        
            if (slackId == userId) {
                if (cancelled) {
                    client.send(JSON.stringify({
                        type: 'cancel',
                        slackId: userId,
                    }));
                } else {
                    client.send(JSON.stringify({
                        type: 'end',
                        slackId: userId,
                    }));
                }
            }
        });
    }
}