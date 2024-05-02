import 'dotenv/config';
import { app, prisma, minuteInterval, hourInterval } from './app.js';
import "./subroutines/onboarding.js";
import "./subroutines/events/picnics.js";
import "./subroutines/events/powerHour.js";
import "./subroutines/hackhour.js";
import "./subroutines/goals.js";
import "./subroutines/misc.js";
import "./subroutines/picnics.js";
import "./subroutines/api.js";

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
        text: `<!subteam^${process.env.DEV_USERGROUP}> I summon thee for the following reason: \`Hack Hour crashed!\`\n*Error:*\n\`\`\`${error.message}\`\`\``,
    });

    await prisma.$disconnect();
    await app.stop();
    
    process.exit(1);        
});
