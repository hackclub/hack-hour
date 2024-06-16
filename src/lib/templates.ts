import { parse } from 'yaml';
import fs from 'fs';
import { prisma } from './prisma.js';

type Template = 
    'complete' | 
    'cancel' | 
    'pause' | 
    'encouragement' | 
    'init' |
    'update' |

    'toplevel.main' |
    'toplevel.pause' |
    'toplevel.cancel' |
    
    'popup.footer' |
    'popup.placeholder' |
    'popup.header' |

    'action.paused' |
    'action.resumed' |

    'evidence_reminder' |

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
    'airtable.rejected' |

    'maintanenceMode' |

    'firstTime.start' |
    'firstTime.toplevel.main' |
    'firstTime.controller' |
    'firstTime.walkthrough.no_evidence' |
    'firstTime.walkthrough.complete' |

    'firstTime.popup.footer' |
    'firstTime.popup.placeholder' |
    'firstTime.popup.header'     
    ;

interface Data {
    slackId?: string,
    minutes?: number,
    repo?: string,
    main?: string,
    status?: string,
    reason?: string,
    url?: string,
}

interface ExtendedData extends Data {
    minutes_units?: string,
}

const file = fs.readFileSync('./src/lib/templates.yaml', 'utf8');
const templatesRaw = parse(file);

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

export const templates: {
    [key in Template]: string[]
} = flatten(templatesRaw);

export const pfps = {
    question: ":rac_question:",
    info: ":rac_info:",
    freaking: ":rac_freaking:",
    cute: ":rac_cute:",
    tinfoil: ":rac_believes_in_theory_about_green_lizards_and_space_lasers:",
    peefest: ":rac_peefest:",
    woah: ":rac_woah:",
    threat: ":rac_threat:",
    thumbs: ":rac_thumbs:",
    ded: ":rac_ded:"
};

export function t(template: Template, data: Data) {
//    return (randomChoice(templates[template]) as string).replace(/\${(.*?)}/g, (_, key) => (data as any)[key])
    return t_format(t_fetch(template), data);
}

export function t_fetch(template: Template) {
    return (randomChoice(templates[template]) as string);
}

export function t_format(template: string, data: Data) {
    const extendedData = {
        ...data,
        minutes_units: data.minutes == 1 ? 'minute' : 'minutes',
    }
    return template.replace(/\${(.*?)}/g, (_, key) => (extendedData as any)[key])
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