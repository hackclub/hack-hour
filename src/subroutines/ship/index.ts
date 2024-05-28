import { emitter } from "../../lib/emitter.js";
import { app } from "../../lib/bolt.js";
import { prisma } from "../../lib/prisma.js";
import { formatHour } from "../slack/lib/templates.js";
import { Environment } from "../../lib/constants.js";

app.message(async ({ message, say }) => {
    if (message.channel !== Environment.SHIP_CHANNEL) return;

    
});