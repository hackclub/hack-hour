import pkg, { type Session } from '@prisma/client';
const { PrismaClient } = pkg

import cuid2 from '@paralleldrive/cuid2';

declare global {
    namespace PrismaJson {
        type SessionMetadata = {
            work: string,
            slack: {
                template: string,
                controllerTemplate: string,
                attachment?: string,
            },
            airtable?: {
                id: string,
                status: string,
                reason: string
            },
            firstTime?: {
                step: number
            }
            banked: boolean,
        }
        type UserMetadata = {
            airtable?: {
                id: string
            },
            ships: {
                [shipTs: string]: string
            },
            firstTime: boolean,
        }
        type LogData = {
            // TODO
        }
        type ScrapbookMetadata = {
            record: string,
            attachments: string[]
        }
    }
}

export const prisma = new PrismaClient().$extends({
    query: {
        async $allOperations({ model, operation, args, query }) {
            console.log(`[prisma.${model}.${operation}] starting operation`)
            const before = Date.now()
            const result = await query(args)
            const after = Date.now()
            console.log(`[prisma.${model}.${operation}] took ${after - before}ms`)
            return result
        },
    },
});

cuid2.init();

export const uid = () => { return cuid2.createId() };

// This method provides a safe way to get the elapsed time from a session.
//
// This method returns minutes.
export function getElapsed(session: Session): number {
    if (session.cancelled || session.completed) {
        return session.elapsed;
    }

    return Math.min(session.time, session.elapsed + (session.paused ? 0 : (Date.now() - session.resumedOrPausedAt.getTime()) / 60_000));
}

// This method provides a safe way to get the elapsed pause time from a session.
//
// This method returns minutes.
export function getElapsedSincePaused(session: Session) {
    if (!session.paused) {
        console.error("getElapsedSincePaused has been called on a session that is not paused. This is likely a mistake.");
        return 0;
    }

    return (Date.now() - session.resumedOrPausedAt.getTime()) / 60_000;
}
