import { AirtableAPI } from "../../../lib/airtable.js";
import { Slack } from "../../../lib/bolt.js";
import { Actions } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { t } from "../../../lib/templates.js";
import { Loading } from "../../slack/views/loading.js";
import { Orders } from "./views/orders.js";

Slack.action(Actions.ORDERS, async ({ body, client }) => {
    const view = await client.views.push({
        trigger_id: (body as any).trigger_id,
        view: Loading.loading(),
    });

    const user = await prisma.user.findFirst({
        where: {
            slackUser: {
                slackId: body.user.id,
            }
        }
    });

    if (!user || !user.metadata.airtable) {
        await Slack.views.update({
            view_id: view.view?.id,
            view: Loading.error(t('error.not_a_user'))
        });

        return;
    }

    const orders = await AirtableAPI.Orders.findByUser(user.metadata.airtable.id);

    await Slack.views.update({
        view_id: view.view?.id,
        view: Orders.order(orders)
    });
});