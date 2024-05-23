import bolt, { ExpressReceiver } from '@slack/bolt'; 
import { prisma } from './prisma.js';
import { Environment } from './constants.js';

const expressReceiver = new bolt.ExpressReceiver({
    signingSecret: Environment.SLACK_SIGNING_SECRET,
    endpoints: '/slack/events',
    processBeforeResponse: true,
});

export const express = expressReceiver.app;

export const app = new bolt.App({
    token: Environment.SLACK_BOT_TOKEN,
    appToken: Environment.SLACK_APP_TOKEN,
    clientId: Environment.CLIENT_ID,
    clientSecret: Environment.CLIENT_SECRET,    

    /*
    installationStore: {
        storeInstallation: async (installation) => {
            // Fetch the user id and token of the installer
            const user = await prisma.slackUser.findUnique({
                where: {
                    slackId: installation.user.id
                }
            });

            if (!installation.team) {
                throw new Error('Failed saving installation data to installationStore');
            }

            if (!user) {
                throw new Error(`Could not find user with slackId ${installation.user.id}`);
            }

            if (!installation.user.token) {
                throw new Error(`Could not find token for user with slackId ${installation.user.id}`);
            }

            // Store the installation
            await prisma.installation.create({
                data: {
                    slackId: installation.user.id,
                    slackToken: installation.user.token,
                    teamId: installation.team.id,
                    userId: user.userId,

                    installation: installation as any
                }
            });
        },
        fetchInstallation: async (installQuery) => {
            const installation = await prisma.installation.findFirst({
                where: {
                    teamId: installQuery.teamId
                }
            });

            if (!installation) {
                throw new Error(`Could not find installation!`);
            }

            return installation.installation as any;
        }
    },*/    
    receiver: expressReceiver,
});

app.error(async (error) => {
    await app.client.chat.postMessage({
        channel: process.env.LOG_CHANNEL || 'C0P5NE354' ,
        text: `<@U04QD71QWS0> I summon thee for the following reason: \`Hack Hour had an error! - Bolt JS\`\n*Error:*\n\`\`\`${error.message}\`\`\``, //<!subteam^${process.env.DEV_USERGROUP}|hack-hour-dev>
    });
});