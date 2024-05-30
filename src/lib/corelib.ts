// Library for interacting with hack hour 
import type { Session as SessionType } from "@prisma/client";

import { prisma } from "./prisma.js";
import { emitter } from "./emitter.js";

interface SessionAction {
    userId?: string;
    slackId?: string;
    session: SessionType;
}

export { SessionType };

// TODO: Implement user validation to prevent unauthorized session cancellations
export class Session {
    /**
     * Cancels a hack hour session
     * @param {SessionType} session - The session to cancel
     */
    public static async cancel(session: SessionType) {
        const updatedSession = await prisma.session.update({
            where: {
                messageTs: session.messageTs
            },
            data: {
                cancelled: true
            }
        });

        emitter.emit('cancel', updatedSession);
    }

    /**
     * Pauses or resumes a hack hour session
     * @param {Session} session - The session to pause or resume
     */
    public static async pause(session: SessionType) {
        // If resuming the session, reset the elapsed time since pause
        const updatedSession = await prisma.session.update({
            where: {
                messageTs: session.messageTs
            },
            data: {
                paused: !session.paused,
                elapsedSincePause: session.paused ? 0 : session.elapsedSincePause
            }
        });
    
        if (updatedSession.paused) {
            emitter.emit('pause', updatedSession);
        } else {
            emitter.emit('resume', updatedSession);
        }
    
        return updatedSession;
    }

    /**
     * Extends the time of a hack hour session
     * @param {SessionType} session - The session to extend
     * @param {number} minutes - The number of minutes to extend the session by
     */
    public static async extend(session: SessionType, minutes: number) {
        const updatedSession = await prisma.session.update({
            where: {
                messageTs: session.messageTs
            },
            data: {
                time: {
                    increment: minutes
                }
            }
        });

        return updatedSession;
    }
}

// TODO: Metadata management
// TODO: Hack Hour app tokens, permissions, and authorization