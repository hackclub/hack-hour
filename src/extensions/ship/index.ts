import { emitter } from "../../lib/emitter.js";
import { app } from "../../lib/bolt.js";
import { prisma } from "../../lib/prisma.js";

import { Environment } from "../../lib/constants.js";
import { Ship } from "./view.js";

app.message(async ({ message, say }) => {
    if (message.channel !== Environment.SHIP_CHANNEL) return;
    if (!message.subtype || message.subtype !== 'file_share') return; // Needs to be a file share event

    const shipTs = message.ts;

    // DM the user to let them know that their ship has been received
    await app.client.chat.postMessage({
        channel: message.user,
        blocks: await Ship.bankGoalInit(shipTs)
    });
});