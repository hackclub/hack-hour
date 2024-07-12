import dotenv from 'dotenv';
dotenv.config({});

export function assertVal<T>(val: T): NonNullable<T> {
    if (val === null || val === undefined) {
        throw new Error(`Expected value to be non-null, but got ${val}`);
    }
    return val;
}

export const Environment = {
    SLACK_BOT_TOKEN: assertVal(process.env.REVIEW_BOT_TOKEN),
    SLACK_SIGNING_SECRET: assertVal(process.env.REVIEW_SIGNING_SECRET),
    
    ADMIN_TOKEN: assertVal(process.env.ADMIN_TOKEN),

    PROD: process.env.PROD == 'true',

    PORT: process.env.REVIEW_PORT || 5876
};

export const Channels = Environment.PROD ? {
    REVIEW: 'C07CXLLPA5N',
    SCRAPBOOK: 'C01504DCLVD',
    MAIN: 'C06SBHMQU8G'
} : {
    REVIEW: 'C079KPS2M5E',
    SCRAPBOOK: 'C063RPGKRL2',
    MAIN: 'C06S6E7CXK7'
};

export const Commands = {};

export const Actions = {
    START_REVIEW: 'start_review',
    
    MAGIC: 'magic',
    UNSUBMIT: 'unsubmit',
    SHIPPED: 'shipped',
    
    APPROVE: 'approve',
    REJECT: 'reject',
    REJECT_LOCK: 'reject_lock',

    UNDO: 'undo',

    NEXT_REVIEW: 'next_review',
};