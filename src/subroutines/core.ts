import { prisma } from "../lib/prisma.js";
import { emitter } from "../lib/emitter.js";
import { Constants } from "../lib/constants.js";

emitter.on('minute', async () => {
    try {
        const sessions = await prisma.session.findMany({
            where: {
                completed: false,
                cancelled: false,
            }
        });

        console.log(`[${new Date()}] 🕒 Updating ${sessions.length} sessions`);

        for (const session of sessions) {   
            let updatedSession = session;

            if (session.paused) {
                updatedSession = await prisma.session.update({
                    where: {
                        messageTs: session.messageTs
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
                            messageTs: session.messageTs
                        },
                        data: {
                            paused: false,
                            cancelled: true,
                        }
                    });

                    emitter.emit('cancel', updatedSession);
                } else {
                    emitter.emit('sessionUpdate', updatedSession);
                }

                continue;
            } else {
                updatedSession = await prisma.session.update({
                    where: {
                        messageTs: session.messageTs
                    },
                    data: {
                        elapsed: {
                            increment: 1
                        }
                    }
                });
            }

            await prisma.goal.updateMany({                
                where: {
                    userId: session.userId,
                    selected: true
                },
                data: {
                    totalMinutes: {
                        increment: 1
                    }
                }
            });

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
                        messageTs: session.messageTs
                    },
                    data: {
                        completed: true
                    }
                });

                emitter.emit('complete', updatedSession);
            } else {
                emitter.emit('sessionUpdate', updatedSession);
            }
        }
    } catch (error) {
        emitter.emit('error', error);
    }
});

emitter.on('start', async (session) => {
    console.log(`[${new Date()}] 🚀 Session started: ${session.messageTs}`);
});

emitter.on('cancel', async (session) => {
    console.log(`[${new Date()}] 🚫 Session cancelled: ${session.messageTs}`);
});

emitter.on('complete', async (session) => {
    console.log(`[${new Date()}] 🏁 Session ${session.messageTs} completed by ${session.userId}`);
});

emitter.on('error', async (error) => {
    console.error(`[${new Date()}] 🚨 Error: ${error.message}`);
});
