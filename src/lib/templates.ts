import { parse } from 'yaml';
import fs from 'fs';

type template = 
    'update' | 
    'complete' | 
    'encouragement' | 
    'cancel' | 
    'toplevel' | 
    'pause' | 
    'init' | 
    'onboarding_init' | 
    'onboarding_update' | 
    'onboarding_complete' |
    'onboarding_evidence_reminder' |
    'activity_detect' |
    'evidence_detect';

interface data {
    slackId?: string,
    minutes?: number,
    repo?: string,
    main?: string,
}

const file = fs.readFileSync('./src/lib/templates.yaml', 'utf8');
const templates = parse(file);

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