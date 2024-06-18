import { app, Slack } from "../../../lib/bolt.js";
import { Actions, Commands, Environment } from "../../../lib/constants.js";
import { t } from "../../../lib/templates.js";
import { informUser } from "../../slack/lib/lib.js";
import { Loading } from "../../slack/views/loading.js";
import { AirtableAPI } from "../../../lib/airtable.js";
import { openModal } from "../../slack/lib/open-modal.js";
import { Shop } from "./view.js";

Slack.command(Commands.SHOP, async ({ command, ack }) => {
    // const view = await Slack.views.open({
    //     trigger_id: command.trigger_id,
    //     view: Loading.loading()
    // });

    const airtableUser = await AirtableAPI.User.lookupBySlack(command.user_id);

    if (!airtableUser) {
        // await ack();
        // informUser(command.user_id, t('error.first_time', {}), command.channel_id);
        await openModal({
            triggerId: command.trigger_id,
            view: Loading.error(t('error.first_time', {}))
        });

        return;
    }

    const remaining = Math.floor(airtableUser.fields["Balance (Minutes)"] / 60);
    const pending = Math.floor(airtableUser.fields["Minutes (Pending Approval)"] / 60);

    // await Slack.views.update()

    await openModal({
        triggerId: command.trigger_id,
        view: Shop.shop(remaining, pending)
    });
});