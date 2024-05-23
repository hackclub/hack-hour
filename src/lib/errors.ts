import { app } from "./bolt.js";

export function handle(error: any) {
    console.error(error);

    app.client.chat.postMessage({
        channel: process.env.LOG_CHANNEL || 'C0P5NE354',
        text: `<!subteam^${process.env.DEV_USERGROUP}> I summon thee for the following reason: \`Hack Hour crashed!\`\n*Error:*\n\`\`\`${error}\`\`\``,
    });
}