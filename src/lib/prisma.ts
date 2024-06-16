import { PrismaClient } from '@prisma/client';
import cuid2 from '@paralleldrive/cuid2';

declare global {
    namespace PrismaJson {
        type SessionMetadata = {
            work: string,
            slack: {
                template: string,
                controllerTemplate: string,
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

cuid2.init();

export const prisma = new PrismaClient();
export const uid = () => { return cuid2.createId() };