import { prisma } from "../app.js"
import { formatHour } from "../utils/string.js";
import { format, randomChoice } from '../utils/string.js';
import { Templates } from "../utils/message.js";

export class Blocks {
    public static async session(session: {
        template: string,
        userId: string,
        goal: string,
        task: string,
        time: number,
    }, attachments: string[] | null=null): Promise<any[]> {
        const goal = await prisma.goals.findUnique({
            where: {
                goalId: session.goal
            }
        });

        const user = await prisma.user.findUnique({
            where: {
                slackId: session.userId
            }
        });

        if (!user) {
            throw new Error(`User ${session.userId} not found`);
        }
        
        if (!goal) {
            throw new Error(`Goal ${session.goal} not found`);
        }

        let blocks: any[] = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": format(session.template, {
                        "userId": session.userId,
                        "minutes": String(session.time),
                    })
                }
            },
            {
                "type": "rich_text",
                "elements": [
                    {
                        "type": "rich_text_quote",
                        "elements": [
                            {
                                "type": "text",
                                "text": session.task
                            }
                        ]
                    }
                ]
            }
        ]        

        if (attachments) {
            blocks.push({
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": attachments.join("\n"),
                    "emoji": true
                }
            });
        }

        if (user.eventId && user.eventId != 'none' && user.eventId != 'None') {
            const event = await prisma.eventContributions.findFirst({
                where: {
                    slackId: session.userId,
                    eventId: user?.eventId
                }
            })
            blocks.push({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": `*Goal:* ${goal?.goalName || 'None'} - _${formatHour(goal?.minutes || 0)} Hours Total_ | *Picnic:* ${user?.eventId} - _${formatHour(event?.minutes || 0)} Hours Total_`
                    }
                ]
            });
        } else {
            blocks.push({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": `*Goal:* ${goal?.goalName || 'None'} - _${formatHour(goal?.minutes || 0)} Hours Total_ | *Picnic:* Unavailable - More coming soon :)`
                    }
                ]
            });
        }

        return blocks;
    }

    /*
    public static async session(messageTs: string, addAttachments: boolean=true): Promise<any[]> {
        console.log(`Getting session ${messageTs} with attachments ${addAttachments}`);

        const session = await prisma.session.findUnique({
            where: {
                messageTs: messageTs
            }
        })

        if (!session) {
            throw new Error(`Session ${messageTs} not found`);
        }
  
        let blocks: any[] = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": format(session.template, {
                        "userId": session.userId,
                        "minutes": String(session.elapsed),
                    })
                }
            },
            {
                "type": "rich_text",
                "elements": [
                    {
                        "type": "rich_text_quote",
                        "elements": [
                            {
                                "type": "text",
                                "text": session.task
                            }
                        ]
                    }
                ]
            }
        ]

        if (session.attachment && addAttachments) {
            blocks.push({
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": JSON.parse(session.attachment).join("\n"),
                    "emoji": true
                }
            })
        }

        const goal = await prisma.goals.findUnique({
            where: {
                goalId: session.goal
            }
        })

        const user = await prisma.user.findUnique({
            where: {
                slackId: session.userId
            }
        })

        if (!user) {
            throw new Error(`User ${session.userId} not found`);
        }

        if (user.eventId || user.eventId == 'None') {
            const event = await prisma.eventContributions.findFirst({
                where: {
                    slackId: session.userId,
                    eventId: user?.eventId
                }
            })
            blocks.push({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": `*Goal:* ${goal?.goalName || 'None'} - _${formatHour(goal?.minutes || 0)} Hours Total_ | *Picnic:* ${user?.eventId} - _${formatHour(event?.minutes || 0)} Hours Total_`
                    }
                ]
            });
        } else {
            blocks.push({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": `*Goal:* ${goal?.goalName || 'None'} - _${formatHour(goal?.minutes || 0)} Hours Total_ | *Picnic:* Unavailable - More coming soon :)`
                    }
                ]
            });
        }

        return blocks;
    }*/

}