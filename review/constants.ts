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

    PORT: process.env.PORT || 3000
};

export const Channels = Environment.PROD ? {
    REVIEW: '',
    SCRAPBOOK: ''
} : {
    REVIEW: 'C079KPS2M5E',
    SCRAPBOOK: 'C063RPGKRL2'
};

export const Commands = {};

export const Actions = {};