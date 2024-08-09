import { getElapsed, getElapsedSincePaused, prisma } from "./lib/prisma.js";
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

        console.log(`[Clock] 🕒 Updating ${sessions.length} sessions`);

        let updateWithRatelimit = true

        if (sessions.length < 20) {
            updateWithRatelimit = false
        } else {
            console.log(`[Clock] Ratelimiting updates`);
        }

        for (const session of sessions) {
            if (session.paused) {
                // in minutes
                let elapsedSincePause = getElapsedSincePaused(session);

                if (elapsedSincePause > Constants.AUTO_CANCEL) {
                    await prisma.session.update({
                        where: {
                            id: session.id
                        },
                        data: {
                            paused: false,
                            cancelled: true,
                        }
                    });

                    emitter.emit('cancel', session);
                } else {
                    if (updateWithRatelimit) {
                        if (elapsedSincePause % 5 === 0) {
                            emitter.emit('sessionUpdate', { updatedSession: session, updateSlack: true });
                        } else {
                            emitter.emit('sessionUpdate', { updatedSession: session, updateSlack: false });
                        }
                    } else {
                        emitter.emit('sessionUpdate', { updatedSession: session, updateSlack: true });
                    }
                }

                continue;
            }

            let elapsed = getElapsed(session);


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

            if (elapsed >= session.time) { // TODO: Commit hours to goal, verify hours with events                
                await prisma.session.update({
                    where: {
                        id: session.id
                    },
                    data: {
                        completed: true,
                        elapsed: {
                            set: session.time
                        }
                    }
                });

                // update lifetime minutes
                await prisma.user.update({
                    where: {
                        id: session.userId
                    },
                    data: {
                        lifetimeMinutes: {
                            increment: session.time
                        },
                    }
                });

                emitter.emit('complete', session);
            } else {
                if (updateWithRatelimit) {
                    if (elapsed % 5 === 0) {
                        emitter.emit('sessionUpdate', { updatedSession: session, updateSlack: true });
                    } else {
                        emitter.emit('sessionUpdate', { updatedSession: session, updateSlack: false });
                    }
                } else {
                    emitter.emit('sessionUpdate', { updatedSession: session, updateSlack: true });
                }
            }
        }
    } catch (error) {
        emitter.emit('error', { error });
    }
});

emitter.on('start', async (session) => {
    console.log(`[Clock] 🚀 Session started: ${session.messageTs}`);
});

emitter.on('cancel', async (session) => {
    console.log(`[Clock] 🚫 Session cancelled: ${session.messageTs}`);
});

emitter.on('complete', async (session) => {
    console.log(`[Clock] 🏁 Session ${session.messageTs} completed by ${session.userId}`);
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
    console.error(`[Error] 🚨 Error: ${error.message}\n${error.stack}`);
});

emitter.on('init', async () => {
    console.log('[Clock] 🕒 Core Subroutine Initialized!');
});
