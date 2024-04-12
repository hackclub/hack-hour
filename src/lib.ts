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

export function genAttachmentBlock(attachments: string): any {
    const attachment = JSON.parse(attachments) as UploadedFile;

    // If the attachment is an image, return an image block
    if (!attachment) { return null; }
 
    if ('thumb_360' in attachment) {
        return {
            type: 'image',
            image_url: attachment.thumb_360,
            alt_text: attachment.title
        }
    } else {
        // Otherwise, just link to the attachment
        return {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `<${attachment.url_private}|${attachment.title}>`
            }
        }        
    }
}