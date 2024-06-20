import { app, Slack } from "../../../lib/bolt.js";
import { Actions, Commands, Environment } from "../../../lib/constants.js";
import { t } from "../../../lib/templates.js";
import { informUser } from "../../slack/lib/lib.js";
import { Loading } from "../../slack/views/loading.js";
import { AirtableAPI } from "../../../lib/airtable.js";
import { Shop } from "./views/shop.js";

// app.command(Commands.SHOP, async ({ command, ack }) => {
//     await ack();

//     const view = await Slack.views.open({
//         trigger_id: command.trigger_id,
//         view: Loading.loading()
//     });

//     const airtableUser = await AirtableAPI.User.lookupBySlack(command.user_id);

//     if (!airtableUser) {
//         // await ack();
//         // informUser(command.user_id, t('error.first_time', {}), command.channel_id);
//         await Slack.views.update({
//             view_id: view?.view?.id,
//             view: Loading.error(t('error.first_time', {}))
//         });

//         return;
//     }

//     const blocks = [];

//     const remaining = Math.floor(airtableUser.fields["Balance (Minutes)"] / 60);
//     const pending = Math.floor(airtableUser.fields["Minutes (Pending Approval)"] / 60);

//     blocks.push({
//         "type": "section",
//         "text": {
//             "type": "mrkdwn",
//             "text": `Available to spend: ${remaining} :tw_admission_tickets:  _(Pending Approval: ${pending})_`
//         }
//     });

//     if (Math.floor(airtableUser.fields["Spent (Incl. Pending)"] / 60) !== 0) {
//         blocks.push({
//             "type": "section",
//             "text": {
//                 "type": "mrkdwn",
//                 "text": `Total banked hours: ${Math.floor(airtableUser.fields["Minutes (Banked)"] / 60)} :tw_admission_tickets: `
//             }
//         });
//     }

//     blocks.push({
//             "type": "divider"
//         },
//         {
//             "type": "actions",
//             "elements": [
//                 {
//                     "type": "button",
//                     "text": {
//                         "type": "plain_text",
//                         "text": "Open the Shop",
//                         "emoji": true
//                     },
//                     'url': `${Environment.SHOP_URL}/arcade/${airtableUser.id}/shop/`,
//                     // 'url': `https://forms.hackclub.com/eligibility?slack_id=${command.user_id}`,
//                     //            "url": `${Environment.SHOP_URL}/arcade/${airtableUser.id}/shop/`,
//                     // "action_id": Actions.OPEN_SHOP
//                 }
//             ],
//             "block_id": "actions",
//         });

//     await Slack.views.update({
//         view_id: view?.view?.id,
//         "view": {
//             "type": "modal",
//             "title": {
//                 "type": "plain_text",
//                 "text": "The Shop",
//                 "emoji": true
//             },
//             "close": {
//                 "type": "plain_text",
//                 "text": "Close",
//                 "emoji": true
//             },
//             "blocks": blocks
//         }
//     })
// });

app.command(Commands.SHOP, async ({ command, ack }) => {
    await ack();

    const view = await Slack.views.open({
        trigger_id: command.trigger_id,
        view: Loading.loading()
    });

    const airtableUser = await AirtableAPI.User.lookupBySlack(command.user_id);

    if (!airtableUser) {
        // await ack();
        // informUser(command.user_id, t('error.first_time', {}), command.channel_id);
        await Slack.views.update({
            view_id: view?.view?.id,
            view: Loading.error(t('error.first_time', {}))
        });

        return;
    }

    await Slack.views.update({
        view_id: view?.view?.id,
        view: Shop.shop({
            spendable: airtableUser.fields["Balance (Hours)"],
            awaitingApproval: Math.floor(airtableUser.fields["Minutes (Pending Approval)"] / 60),
            inOrders: Math.floor(airtableUser.fields["In Pending (Minutes)"] / 60),
            spent: Math.floor(airtableUser.fields["Spent Fulfilled (Minutes)"] / 60)
        })
    })
});