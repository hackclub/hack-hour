import { emitter } from "../../lib/emitter.js";
import { app } from "../../lib/bolt.js";
import { Meta } from "./meta.js";
import { prisma } from "../../lib/prisma.js";
import { formatHour } from "../slack/lib/templates.js";

emitter.on('init', async () => {
    console.log('🕹️ Arcade Hour Subroutine Initialized!');

    const now = new Date();

    if (now > Meta.START_TIME && now < Meta.END_TIME) {
        emitter.emit('setFlag', 'enableVerify', true);
    } else {
        emitter.emit('setFlag', 'enableVerify', false);
    }
});

emitter.on('hour', async () => {
    const now = new Date();

    if (now > Meta.START_TIME && now < Meta.END_TIME) {
        emitter.emit('setFlag', 'enableVerify', true);
    } else {
        emitter.emit('setFlag', 'enableVerify', false);
    }
});

app.command('/testadmin', async ({ ack, body, client }) => {
    await ack();

    const subCommand = body.text.split(' ')[0];
    const subArgs = body.text.split(' ').slice(1);

    switch (subCommand) {
        case 'enableVerify':
            emitter.emit('setFlag', 'enableVerify', true);
            break;
        case 'disableVerify':
            emitter.emit('setFlag', 'enableVerify', false);
            break;
        case 'update':
            const users = await prisma.user.findMany();

            let totalMinutes = 0;

            const sessions = await prisma.session.findMany({
                where: {
                    verifiedSession: {
                        verified: true
                    },
                    createdAt: {
                        gte: Meta.START_TIME,
                        lt: Meta.END_TIME
                    }
                }
            });

            for (const session of sessions) {
                totalMinutes += session.elapsed;
            }

            await client.chat.postEphemeral({
                user: body.user_id,
                channel: body.channel_id,
                text: `Total verified minutes: ${totalMinutes} minutes - ${formatHour(totalMinutes)}`
            });
        default:
            await client.chat.postEphemeral({
                user: body.user_id,
                channel: body.channel_id,
                text: 'Invalid subcommand.'
            });
            break;
    }
});