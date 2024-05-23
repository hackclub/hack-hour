import { stringify, parse } from 'yaml';
import fs from 'fs';

type template = 'update' | 'complete' | 'encouragement' | 'cancel';

interface data {
    slackId?: string,
    minutes?: number
}

type attribute = keyof data;

export function t(template: template, data: data) {
    const file = fs.readFileSync('./src/lib/templates.yaml', 'utf8');
    const templates = parse(file);
    
    return (randomChoice(templates[template]) as string).replace(/\${(.*?)}/g, (_, key) => (data as any)[key])
}

export function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

export function formatHour(minutes: number | undefined | null): string {
    if (!minutes) { return '0.0'; }

    const hours = minutes / 60

    return hours.toFixed(1);
}

export function generateMessageURL(ts: string) {
    // Converts slack ts from payload into a url
    return `https://hackclub.slack.com/archives/C06S6E7CXK7/p${ts.replace('.', '')}`
}