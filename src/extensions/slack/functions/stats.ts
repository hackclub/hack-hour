import { app, Slack } from "../../../lib/bolt.js";
import { Commands, Callbacks, Actions, Environment } from "../../../lib/constants.js";
import { emitter } from "../../../lib/emitter.js";
import { prisma } from "../../../lib/prisma.js";
import { t } from "../../../lib/templates.js";
import { informUser } from "../lib/lib.js";
import { Loading } from "../views/loading.js";
import { Stats } from "../views/stats.js";

Slack.action(Actions.VIEW_STATS, async ({ ack, body }) => {
    try {
        await ack();

        const view = await Slack.views.open({
            trigger_id: (body as any).trigger_id,
            view: Loading.loading(),
        });

        const slackId = body.user.id;

        const user = await prisma.user.findFirst({
            where: {
                slackUser: {
                    slackId
                }
            }
        });

        if (!user) {
            // informUser(slackId, t('error.not_a_user'), Environment.MAIN_CHANNEL, (body as any).message.ts);
            await Slack.views.update({
                view_id: view?.view?.id,
                view: Loading.error(t('error.not_a_user'))
            });
            return;
        }        

        if (user.metadata.firstTime) {
            // informUser(slackId, t('error.first_time'), Environment.MAIN_CHANNEL);
            await Slack.views.update({
                view_id: view?.view?.id,
                view: Loading.error(t('error.first_time'))
            });
            return;
        }        

        await Slack.views.update({
            view_id: view?.view?.id,
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

    const view = await Slack.views.open({
        trigger_id: triggerId,
        view: Loading.loading(),
    });

    const user = await prisma.user.findFirst({
        where: {
            slackUser: {
                slackId
            }
        }
    });

    if (!user) {
        // informUser(slackId, t('error.not_a_user'), channelId);
        await client.views.update({
            view_id: view?.view?.id,
            view: Loading.error(t('error.not_a_user'))
        });
        return;
    }

    if (user.metadata.firstTime) {
        // informUser(slackId, t('error.first_time'), body.channel_id);
        await client.views.update({
            view_id: view?.view?.id,
            view: Loading.error(t('error.first_time'))
        });
    }

    await client.views.update({
        view_id: view?.view?.id,
        view: await Stats.stats(user.id),            
    });
});

Slack.view(Actions.VIEW_STATS, async ({ ack, body }) => {});