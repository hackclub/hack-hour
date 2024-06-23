import { Server } from "http";
import { prisma } from "../../lib/prisma.js";
import { emitter } from "../../lib/emitter.js";
import { app, express } from "../../lib/bolt.js";
import { WebSocket, WebSocketServer } from 'ws';
import { Event } from "../../lib/emitter.js";
import { Session } from "@prisma/client";
import { AirtableAPI } from "../../lib/airtable.js";

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

express.get('/api/clock/:slackId', async (req, res) => {
    const slackId = req.params.slackId;
    const slackUser = await prisma.slackUser.findFirst({
        where: {
            slackId: slackId,
        },
    });

    if (!slackUser) {
        return res.status(404).send('User not found');
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

// async function syncEvent(event: Event, session: Session, client: WebSocket) {
//     const token = (client as any).meta.token;

//     if (!token) {
//         return;
//     }

//     const user = await prisma.user.findUnique({
//         where: {
//             apiKey: token,
//         },
//     }); 

//     if (!user) {
//         return;
//     }

//     if (user.id === session.userId) {
//         client.send(JSON.stringify({
//             type: event,
//             userId: user.id,
//         }));
//     }    
// }

// // Create a WSS instance but don't start it yet
// emitter.on('init', (server: Server) => {
//     const wss = new WebSocketServer({
//         server: server,
//     });

//     // Get user id filter
//     wss.on('connection', (ws) => {
//         (ws as any).meta = {
//             token: '',
//         };

//         ws.on('message', (message) => {
//             console.log(`Received message => ${message}`);

//             // Convert raw data to JSON
//             const data = JSON.parse(String(message));

//             if (data.type === 'subscribe') {
//                 // Attach metadata to the websocket connection
//                 (ws as any).meta.token = data.token;

//                 // Send a confirmation message
//                 ws.send(JSON.stringify({
//                     type: 'subscribe',
//                     ok: true,
//                 }));
//             }
//         });
//     });

//     emitter.on('minute', async () => {
//         wss.clients.forEach(async (client) => {
//             const token = (client as any).meta.token;

//             if (!token) {
//                 return;
//             }

//             const user = await prisma.user.findUnique({
//                 where: {
//                     apiKey: token,
//                 },
//             }); 
            
//             if (user) {
//                 const results = await prisma.session.findMany({
//                     where: {
//                         userId: user.id,
//                         completed: false,
//                         cancelled: false,
//                     },
//                 });
            
//                 if (results.length > 0) {
//                     client.send(JSON.stringify({
//                         type: 'session',
//                         id: results[0].messageTs,
//                         minutes: results[0].time - results[0].elapsed,
//                     }));
//                 }
//             }
//         });
//     });

//     emitter.on('start', (session) => {
//         wss.clients.forEach(async (client) => {
//             await syncEvent('start', session, client);
//         });
//     });

//     emitter.on('complete', (session) => {
//         wss.clients.forEach(async (client) => {
//             await syncEvent('complete', session, client);
//         });
//     });

//     emitter.on('cancel', (session) => {
//         wss.clients.forEach(async (client) => {
//             await syncEvent('cancel', session, client);
//         });
//     });

//     emitter.on('pause', (session) => {
//         wss.clients.forEach(async (client) => {
//             await syncEvent('pause', session, client);
//         });
//     });

//     emitter.on('resume', (session) => {
//         wss.clients.forEach(async (client) => {
//             await syncEvent('resume', session, client);
//         });
//     });

//     console.log('🛜 WebSocket Server Initialized!');
// });
