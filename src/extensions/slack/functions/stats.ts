import { app, Slack } from "../../../lib/bolt.js";
import { Commands, Callbacks, Actions, Environment } from "../../../lib/constants.js";
import { emitter } from "../../../lib/emitter.js";
import { prisma } from "../../../lib/prisma.js";
import { informUser } from "../lib/lib.js";
import { Stats } from "../views/stats.js";

Slack.action(Actions.VIEW_STATS, async ({ ack, body }) => {
    try {
        const slackId = body.user.id;

        const user = await prisma.user.findFirst({
            where: {
                slackUser: {
                    slackId
                }
            }
        });

        if (!user) {
            informUser(slackId, `Run \`${Commands.HACK}\`!`, Environment.MAIN_CHANNEL, (body as any).message.ts);
            return;
        }

        await app.client.views.open({
            trigger_id: (body as any).trigger_id,
            view: await Stats.stats(user.id),
        });
    } catch (error) {
        emitter.emit("error", error);
    }
});

Slack.command(Commands.STATS, async ({ ack, body, client }) => {
    const slackId = body.user_id;
    const channelId = body.channel_id;
    const triggerId = body.trigger_id;

    const user = await prisma.user.findFirst({
        where: {
            slackUser: {
                slackId
            }
        }
    });

    if (!user) {
        informUser(slackId, `Run \`${Commands.HACK}\`!`, channelId);
        return;
    }

    await client.views.open({
        trigger_id: triggerId,
        view: await Stats.stats(user.id),            
    });
});

Slack.view(Actions.VIEW_STATS, async ({ ack, body }) => {});