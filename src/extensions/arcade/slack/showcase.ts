import { Slack } from "../../../lib/bolt.js";
import { Actions, Commands } from "../../../lib/constants.js";
import { formatHour, t } from "../../../lib/templates.js";
import { Loading } from "../../slack/views/loading.js";
import { AirtableAPI } from "../../../lib/airtable.js";
import { Shop } from "./views/shop.js";
import { prisma, uid } from "../../../lib/prisma.js";
import { Showcase } from "./views/showcase.js";

Slack.command(Commands.SHOP, async ({ command }) => {
    const view = await Slack.views.open({
        trigger_id: command.trigger_id,
        view: Loading.loading()
    });

    const airtableUser = await AirtableAPI.User.lookupBySlack(command.user_id);

    if (!airtableUser) {
        // informUser(command.user_id, t('error.first_time'), command.channel_id);
        await Slack.views.update({
            view_id: view?.view?.id,
            view: Loading.error(t('error.first_time'))
        });

        return;
    }

    let loginLink = airtableUser.fields['Login Link'];

    if (loginLink == '') {
        await AirtableAPI.User.update(airtableUser.id, {
            'Login Token': uid()
        });

        const updatedUser = await AirtableAPI.User.lookupBySlack(command.user_id);
        loginLink = updatedUser ? updatedUser.fields['Login Link'] : '';
    }

    await Slack.views.update({
        view_id: view?.view?.id,
        view: Showcase.showcase({
            loginLink
        })
    })
});