import dotenv from 'dotenv';
dotenv.config();

import { AirtableAPI } from '../src/extensions/ship/airtable.js';
import { prisma, uid } from '../src/lib/prisma.js';
import { app } from '../src/lib/bolt.js';
import { Prisma } from '@prisma/client';

const users = await AirtableAPI.User.fetchAll();
const sessions = await AirtableAPI.Session.fetchAll();
const banks = await AirtableAPI.Banks.fetchAll();

for (const user of users) {
    console.log(user.fields['Slack ID']);

    await prisma.slackUser.upsert({
        where: {
            slackId: user.fields['Slack ID']
        },
        create: {
            slackId: user.fields['Slack ID'],
            user: {
                create: {
                    id: user.fields['Internal ID'],
                    lifetimeMinutes: 0,
                    apiKey: uid(),
                    goals: {
                        create: {
                            id: uid(),
                            createdAt: new Date(),
                            
                            name: 'No Goal',
                            description: 'No Goal',

                            totalMinutes: 0,
                            selected: true,
                        }
                    }
                }
            },        
            tz_offset: 0,
        },
        update: {}
    });
}

for (const session of sessions) {
    console.log(session.fields['Code URL']);

    //https://hackclub.slack.com/archives/C06SBHMQU8G/p1717768026738639?thread_ts=1717768026.738639&cid=C06SBHMQU8G
    //1717768026.738639
    const codeUrl =  session.fields['Code URL'];

    const messageTsChunks = codeUrl.split('archives/')[1].split('/')[1];
    const messageTsFull = messageTsChunks.split('?')[0];
    const messageTsNoP = messageTsFull.slice(1);
    const messageTs = messageTsNoP.slice(0, -6) + '.' + messageTsNoP.slice(-6);

    const userRecord = session.fields['User'][0];
    const userData = users.find(u => u.id === userRecord);

    const user = await prisma.slackUser.findUnique({
        where: {
            slackId: userData?.fields['Slack ID']
        },
        include: {
            user: true
        }
    });

    await prisma.session.upsert({
        where: {
            messageTs: messageTs
        },
        create: {
            messageTs: messageTs,
            cancelled: false,
            completed: true,
            controlTs: uid(),
            createdAt: new Date(session.fields['Created At']),
            elapsed: session.fields['Minutes'],
            time: session.fields['Minutes'],
            elapsedSincePause: 0,
            paused: false,
            
            user: {
                connectOrCreate: {
                    where: {
                        id: userData?.fields['Internal ID']
                    },
                    create: {
                        id: userData!.fields['Internal ID'],
                        slackUser: {
                            create: {
                                slackId: userData!.fields['Slack ID'],
                                tz_offset: 0,
                            }
                        },
                        lifetimeMinutes: 0,
                        apiKey: uid(),
                    }
                }
            },
            
            metadata: {
                work: session.fields['Work'],
                airtable: {
                    id: session.id,
                    status: session.fields['Status'],
                    reason: session.fields['Reason'],
                },            
                slack: {
                    template: 'slack',
                }
            }
        },
        update: {}
    });
}

for (const bank of banks) {
    console.log(bank.fields['Ship ID']);
    const userRecord = bank.fields['User'][0];
    const userData = users.find(u => u.id === userRecord);

    const user = await prisma.slackUser.findUnique({
        where: {
            slackId: userData?.fields['Slack ID']
        },
        include: {
            user: true
        }
    });

    await prisma.bank.upsert({
        where: {
            id: bank.fields['Ship ID']
        },
        create: {
            id: bank.fields['Ship ID'],
            user: {
                connect: {
                    id: user?.user.id
                }
            },
            type: 'ship',
            minutes: bank.fields['Approved Minutes'],
            data: {
                shipURL: bank.fields['Ship URL'],
            },
            sessions: bank.fields['Sessions'] ? {
                connect: bank.fields['Sessions'].map((recordId: string) => {
                    const session = sessions.find(s => s.id === recordId) as any;
                    const messageTsChunks = session.fields['Code URL'].split('archives/')[1].split('/')[1];
                    const messageTsFull = messageTsChunks.split('?')[0];
                    const messageTsNoP = messageTsFull.slice(1);
                    const messageTs = messageTsNoP.slice(0, -6) + '.' + messageTsNoP.slice(-6);
                    return {
                        messageTs: messageTs
                    } 
                }) 
            } : undefined
        },
        update: {}
    });
}

console.log('Done!');

// figure out what the extra users are