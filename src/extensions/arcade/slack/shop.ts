import { Slack } from "../../../lib/bolt.js";
import { Commands } from "../../../lib/constants.js";
import { t } from "../../../lib/templates.js";
import { Loading } from "../../slack/views/loading.js";
import { AirtableAPI } from "../../../lib/airtable.js";
import { Shop } from "./view.js";

Slack.command(Commands.SHOP, async ({ command, ack, client }) => {
    try {
        const result = await Slack.views.open({
            trigger_id: command.trigger_id,
            view: Loading.loading()
        });

        const viewId = result!.view!.id;

        const airtableUser = await AirtableAPI.User.lookupBySlack(command.user_id);

        if (!airtableUser) {
            await Slack.views.update({
                view_id: viewId,
                view: Loading.error(t('error.first_time', {}))
            });

            return;
        }

        const remaining = Math.floor(airtableUser.fields["Balance (Minutes)"] / 60);
        const pending = Math.floor(airtableUser.fields["Minutes (Pending Approval)"] / 60);
        const spent = Math.floor(airtableUser.fields["Spent (Incl. Pending)"] / 60);
        const banked = Math.floor(airtableUser.fields["Minutes (Banked)"] / 60)

        try {
            await Slack.views.update({
                view_id: viewId,
                view: Shop.shop(remaining, pending, spent, banked, airtableUser.id)
            });
        } catch (error) {
            console.error('Error updating view:', error);
        }

    } catch (error) {
        console.error('Error opening view:', error);
    }
});