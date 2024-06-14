import { app } from "../../../lib/bolt.js";
import { Commands } from "../../../lib/constants.js";
import { informUser } from "../../slack/lib/lib.js";
import { AirtableAPI } from "../lib/airtable.js";

app.command(Commands.SHOP, async ({ command, ack }) => {
    const airtableUser = await AirtableAPI.User.find(command.user_id);

    if (!airtableUser) {
        await ack();
        informUser(command.user_id, "Error", command.channel_id);
        return;
    }

    await ack();

    const blocks = [];

    const remaining = Math.floor(airtableUser.fields["Balance (UI)"]/60);

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
            "text": `<https://hackclub.com/arcade/?user=${command.user_id}|Open The Shop>`
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