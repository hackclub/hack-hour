// import { Slack } from "../../../lib/bolt.js";
// import { Actions, Commands, Environment } from "../../../lib/constants.js";
// import { formatHour, t } from "../../../lib/templates.js";
// import { Loading } from "../../slack/views/loading.js";
// import { AirtableAPI } from "../../../lib/airtable.js";
// import { Shop } from "./views/shop.js";
// import { prisma } from "../../../lib/prisma.js";

// Slack.command(Commands.SHOP, async ({ command }) => {
//     const view = await Slack.views.open({
//         trigger_id: command.trigger_id,
//         view: Loading.loading()
//     });

//     const airtableUser = await AirtableAPI.User.lookupBySlack(command.user_id);

//     const user = await prisma.user.findFirst({
//         where: {
//             slackUser: {
//                 slackId: command.user_id
//             }
//         }
//     });

//     if (!airtableUser || !user) {
//         // informUser(command.user_id, t('error.first_time'), command.channel_id);
//         await Slack.views.update({
//             view_id: view?.view?.id,
//             view: Loading.error(t('error.first_time'))
//         });

//         return;
//     }

//     await Slack.views.update({
//         view_id: view?.view?.id,
//         view: Shop.shop({
//             recordId: airtableUser.id,
//             spendable: airtableUser.fields["Balance (Hours)"],
//             awaitingApproval: Math.floor(airtableUser.fields["Minutes (Pending Approval)"] / 60),
//             inOrders: Math.floor(airtableUser.fields["In Pending (Minutes)"] / 60),
//             spent: Math.floor(airtableUser.fields["Spent Fulfilled (Minutes)"] / 60),
//         })
//     })
// });

// Slack.action(Actions.OPEN_SHOP, async ({ body }) => {
//     const view = await Slack.views.open({
//         trigger_id: (body as any).trigger_id,
//         view: Loading.loading()
//     });

//     const airtableUser = await AirtableAPI.User.lookupBySlack(body.user.id);

//     const user = await prisma.user.findFirst({
//         where: {
//             slackUser: {
//                 slackId: body.user.id
//             }
//         }
//     });

//     if (!airtableUser || !user) {
//         // informUser(body.user.id, t('error.first_time'), body.channel.id);
//         await Slack.views.update({
//             view_id: view?.view?.id,
//             view: Loading.error(t('error.first_time'))
//         });

//         return;
//     }

//     await Slack.views.update({
//         view_id: view?.view?.id,
//         view: Shop.shop({
//             recordId: airtableUser.id,
//             spendable: airtableUser.fields["Balance (Hours)"],
//             awaitingApproval: Math.floor(airtableUser.fields["Minutes (Pending Approval)"] / 60),
//             inOrders: Math.floor(airtableUser.fields["In Pending (Minutes)"] / 60),
//             spent: Math.floor(airtableUser.fields["Spent Fulfilled (Minutes)"] / 60),
//         })
//     })
// });
