import 'dotenv/config';
import fs from 'fs';

import { prisma } from './lib/prisma.js';
import { emitter } from './lib/emitter.js';
import { app } from './lib/bolt.js'

import './core.js';

// Programmatically import index.ts from each extension in the extensions folder
const extensions = await fs.promises.readdir('./src/extensions');

await Promise.all(extensions.map(async (extension) => {
    if (!(await fs.promises.lstat(`./src/extensions/${extension}`)).isDirectory()) return;

    await import(`./extensions/${extension}/index.js`);
}));

try {
    await prisma.$connect();
    const server = await app.start(process.env.PORT || 3000);

    emitter.emit("init", server);

    console.log(`⏳ Let the Hack Houring Begin! Running on port ${process.env.PORT || 3000}...`);
} catch (error) {
    console.error(error);

    emitter.emit("error", error);

    await prisma.$disconnect();
    await app.stop();
    
    process.exit(1);        
}

import '../scripts/banksToAirtable.js';