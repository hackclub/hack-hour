import 'dotenv/config';

import { prisma } from './lib/prisma.js';
import { minuteInterval, hourInterval } from './lib/interval.js';
import { express, app } from './lib/bolt.js'

import './subroutines/main.js';

((async () => {
    await prisma.$connect();
    await app.start(process.env.PORT || 3000);
    minuteInterval.start();
    hourInterval.start();    

    console.log(`⏳ Let the Hack Houring Begin! Running on port ${process.env.PORT || 3000}...`);
})()).catch(async (error) => {
    console.error(error);

    await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,        
        channel: process.env.LOG_CHANNEL || 'C0P5NE354' ,
        text: `<!subteam^${process.env.DEV_USERGROUP}> I summon thee for the following reason: \`Hack Hour crashed!\`\n*Error:*\n\`\`\`${error.message}\`\`\``,
    });

    await prisma.$disconnect();
    await app.stop();
    
    process.exit(1);        
});
