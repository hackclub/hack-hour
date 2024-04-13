import { Block, UploadedFile } from "@slack/bolt";

export function format(template: string, data: { [key: string]: string }) {
    return template.replace(/\${(.*?)}/g, (_, key) => data[key])
}

export function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

export function formatHour(minutes: number | undefined | null): string {
    if (!minutes) { return '0.0'; }

    const hours = minutes / 60

    return hours.toFixed(1);
}