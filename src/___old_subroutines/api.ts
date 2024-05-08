import { Server } from "http";
import { prisma } from "../lib/prisma.js";
import { minuteInterval } from "../lib/interval.js";
import { express } from "../app.js";
import { WebSocketServer } from 'ws';

express.app.get('/', async (req, res) => {
    await res.send('Hello World!');
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
                /*
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
                */
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