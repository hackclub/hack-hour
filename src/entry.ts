import 'dotenv/config';

import { prisma } from './lib/prisma.js';
import { emitter } from './lib/emitter.js';
import { app } from './lib/bolt.js'

import './subroutines/core.js';
import './subroutines/slack/index.js';
//import './subroutines/slack_verifier/index.js';
//import './subroutines/arcade_hour/index.js';

((async () => {
    await prisma.$connect();
    await app.start(process.env.PORT || 3000);

    emitter.emit("init");

    console.log(`⏳ Let the Hack Houring Begin! Running on port ${process.env.PORT || 3000}...`);
})()).catch(async (error) => {
    console.error(error);

    emitter.emit("error", error);

    await prisma.$disconnect();
    await app.stop();
    
    process.exit(1);        
});