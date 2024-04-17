import 'dotenv/config';
import { app, prisma, minuteInterval, hourInterval } from './app.js';
import "./subroutines/onboarding.js";
import "./subroutines/hackhour.js";
import "./subroutines/goals.js";
import "./subroutines/picnics.js";
import "./subroutines/misc.js";

import { Constants } from './constants.js';

const mainLoop = async () => {
    await prisma.$connect();
    await app.start(process.env.PORT || 3000);
    minuteInterval.start();
    hourInterval.start();    

    console.log(`⏳ Let the Hack Houring Begin! Running on port ${process.env.PORT || 3000}...`);
}

mainLoop().catch(async (error) => {
    console.error(error);
    await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,        
        channel: process.env.LOG_CHANNEL || 'C0P5NE354' ,
        text: `<@U04QD71QWS0> I summon thee for the following reason: \`Hack Hour crashed!\`\n*Error:*\n\`\`\`${error.message}\`\`\``, //<!subteam^${process.env.DEV_USERGROUP}|hack-hour-dev>
    });

    await prisma.$disconnect();
    await app.stop();
    
    process.exit(1);    
});
