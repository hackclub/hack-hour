import { app } from "../../../lib/bolt.js";
import { Commands, Environment } from "../../../lib/constants.js";
import { t } from "../../../lib/templates.js";
import { informUser } from "../../slack/lib/lib.js";
import { AirtableAPI } from "../lib/airtable.js";

app.command(Commands.SHOP, async ({ command, ack }) => {
    const airtableUser = await AirtableAPI.User.lookupBySlack(command.user_id);

    if (!airtableUser) {
        await ack();
        informUser(command.user_id, t('error.generic', {}), command.channel_id);
        return;
    }

    await ack();

    const blocks = [];

    const remaining = Math.floor(airtableUser.fields["Balance (Minutes)"]/60);

    blocks.push({
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": `Available to spend: ${remaining} :zap:`
        }
    });

    if (Math.floor(airtableUser.fields["Spent (Incl. Pending)"]/60) !== 0) {
        blocks.push({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `Total banked hours: ${Math.floor(airtableUser.fields["Minutes (Banked)"]/60)} :zap:`
            }
        });
    }

    blocks.push({
        "type": "divider"
    },
    {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": `<${Environment.SHOP_URL}/arcade/${airtableUser.id}/shop/|Open The Shop>`
        }
    });
    
    app.client.views.open({
        "trigger_id": command.trigger_id,
        "view": {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "The Shop",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Close",
                "emoji": true
            },
            "blocks": blocks
        }
    })
});