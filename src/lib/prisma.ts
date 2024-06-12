import { PrismaClient } from '@prisma/client';
import cuid2 from '@paralleldrive/cuid2';

declare global {
    namespace PrismaJson {
        type SessionMetadata = {
            work: string,
            slack?: {
                "template": string
            },
            airtable?: {
                id: string,
                status: string
            },
			git?: string
        }
        type UserMetadata = {
            ships: {
                [shipTs: string]: string
            }
        }
        type LogData = {
            // TODO
        }
    }
}

cuid2.init();

export const prisma = new PrismaClient();
export const uid = () => { return cuid2.createId() };