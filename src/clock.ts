import { prisma } from "./lib/prisma.js";
import { emitter } from "./lib/emitter.js";
import { Constants } from "./lib/constants.js";

emitter.on('minute', async () => {
    try {
        const sessions = await prisma.session.findMany({
            where: {
                completed: false,
                cancelled: false,
            }
        });

        console.log(`[${new Date().toISOString()}] 🕒 Updating ${sessions.length} sessions`);

        let updateWithRatelimit = true

        if (sessions.length < 20) {
            updateWithRatelimit = false
        }

        for (const session of sessions) {   
            let updatedSession = session;

            if (session.paused) {
                updatedSession = await prisma.session.update({
                    where: {
                        id: session.id
                    },
                    data: {
                        elapsedSincePause: {
                            increment: 1
                        }
                    }
                });

                if (updatedSession.elapsedSincePause > Constants.AUTO_CANCEL) {
                    updatedSession = await prisma.session.update({
                        where: {
                            id: session.id
                        },
                        data: {
                            paused: false,
                            cancelled: true,
                        }
                    });

                    emitter.emit('cancel', updatedSession);
                } else {
                    if (updateWithRatelimit) {
                        if (updatedSession.elapsedSincePause % 5 === 0) {
                            emitter.emit('sessionUpdate', {updatedSession, updateSlack: true });
                        } else {
                            emitter.emit('sessionUpdate', {updatedSession, updateSlack: false });
                        }
                    } else {
                        emitter.emit('sessionUpdate', {updatedSession, updateSlack: true });
                    }
                }

                continue;
            } else {
                updatedSession = await prisma.session.update({
                    where: {
                        id: session.id
                    },
                    data: {
                        elapsed: {
                            increment: 1
                        }
                    }
                });
            }

            await prisma.user.update({
                where: {
                    id: session.userId
                },
                data: {
                    lifetimeMinutes: {
                        increment: 1
                    },
                }
            });  

            if (updatedSession.elapsed >= updatedSession.time) { // TODO: Commit hours to goal, verify hours with events                
                updatedSession = await prisma.session.update({
                    where: {
                        id: session.id
                    },
                    data: {
                        completed: true
                    }
                });

                emitter.emit('complete', updatedSession);
            } else {
                emitter.emit('sessionUpdate', {updatedSession, updateSlack: false});
            }
        }
    } catch (error) {
        emitter.emit('error', {error});
    }
});

emitter.on('start', async (session) => {
    console.log(`[${new Date().toISOString()}] 🚀 Session started: ${session.messageTs}`);
});

emitter.on('cancel', async (session) => {
    console.log(`[${new Date().toISOString()}] 🚫 Session cancelled: ${session.messageTs}`);
});

emitter.on('complete', async (session) => {
    console.log(`[${new Date().toISOString()}] 🏁 Session ${session.messageTs} completed by ${session.userId}`);
});

emitter.on('error', async (errorRef) => {
    let error = errorRef.error;
    if (!error) {
        error = {};
    }
    if (!error.message) {
        return;
    }
    if (!error.stack) {
        return;
    }
    console.error(`[${new Date().toISOString()}] 🚨 Error: ${error.message}\n${error.stack}`);
});

emitter.on('init', async () => {
    console.log('🕒 Core Subroutine Initialized!');
});