import { parse } from 'yaml';
import fs from 'fs';
import { prisma } from './prisma.js';

type template = 
    'update' | 
    'complete' | 
    'encouragement' | 
    'cancel' | 
    'toplevel' | 
    'pause' | 
    'init' |
    'hack' |

    'action.paused' |
    'action.resumed' |

    'onboarding.init' |
    'onboarding.encouragement' |
    'onboarding.update' |
    'onboarding.complete' |
    'onboarding.evidence_reminder' |
    'onboarding.new_face' |

    'detect.activity' |
    'detect.evidence' |

    'error.already_hacking' |
    'error.not_hacking' |
    'error.empty_text' |
    'error.not_a_user' |
    'error.already_resumed' |
    'error.not_yours' |
    'error.generic' |

    'airtable.approved' |
    'airtable.rejected' 
    ;

interface data {
    slackId?: string,
    minutes?: number,
    repo?: string,
    main?: string,
    status?: string,
    reason?: string,
}

const file = fs.readFileSync('./src/lib/templates.yaml', 'utf8');
const templatesRaw = parse(file);

/*
{
    "update": [x, y, z],
    "onboarding": {
        "update": [x, y, z],
    } 
}

flatten

{
    "update": [x, y, z],
    "onboarding.update": [x, y, z],
}
*/

function flatten(obj: any, prefix: string = '') {
    let result: any = {};

    for (const key in obj) {
        if (typeof obj[key] === 'object' && Array.isArray(obj[key]) === false) {
            result = { ...result, ...flatten(obj[key], `${prefix}${key}.`) }
        } else {
            result[`${prefix}${key}`] = obj[key];
        }
    }

    return result;
}

const templates = flatten(templatesRaw);

const pfpFile = fs.readFileSync('./src/lib/haccoon.yaml', 'utf8');
export const pfps = parse(pfpFile);

export function t(template: template, data: data) {
//    return (randomChoice(templates[template]) as string).replace(/\${(.*?)}/g, (_, key) => (data as any)[key])
    return t_format(t_fetch(template), data);
}

export function t_fetch(template: template) {
    return (randomChoice(templates[template]) as string);
}

export function t_format(template: string, data: data) {
    return template.replace(/\${(.*?)}/g, (_, key) => (data as any)[key])
}

export function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

export function formatHour(minutes: number | undefined | null): string {
    if (!minutes) { return '0.0'; }

    const hours = minutes / 60

    return hours.toFixed(1);
}

export async function arcadeUrl(slackId: string) {
    const user = await prisma.slackUser.findUnique({
        where: {
            slackId: slackId
        },
        select: {
            user: true
        }
    });

    const airtableRecord = user?.user.metadata.airtable?.id;

    return `https://hack.club.com/arcade-shop?user_id=${airtableRecord}&slack_id=${slackId}`;
}