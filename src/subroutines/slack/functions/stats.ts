import { app } from "../../../lib/bolt.js";
import { Commands, Callbacks } from "../../../lib/constants.js";
import { emitter } from "../../../lib/emitter.js";
import { prisma } from "../../../lib/prisma.js";
import { Stats } from "../views/stats.js";

app.command(Commands.STATS, async ({ ack, body, client }) => {
    try {
        const slackId = body.user_id;

        await ack();

        const user = await prisma.user.findFirst({
            where: {
                slackUser: {
                    slackId
                }
            }
        });

        if (!user) {
            throw new Error(`User ${slackId} not found.`);
        }

        await client.views.open({
            trigger_id: body.trigger_id,
            view: await Stats.stats(user.id),            
        });
    } catch (error) {
        emitter.emit("error", error);
    }
});

app.view(Callbacks.STATS, async ({ ack }) => {
    try {
        await ack();
    } catch (error) {
        emitter.emit("error", error);
    }
});