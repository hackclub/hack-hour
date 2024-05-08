import { app } from "./bolt.js";

export const execute = async (fn: Function) => {
    try {
        return await fn();
    } catch (error: any) {
        console.error(error);

        await app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,        
            channel: process.env.LOG_CHANNEL || 'C0P5NE354' ,
            text: `<!subteam^${process.env.DEV_USERGROUP}> I summon thee for the following reason: \`Hack Hour crashed!\`\n*Error:*\n\`\`\`${error.message}\`\`\``,
        });

        throw error;
    }
}