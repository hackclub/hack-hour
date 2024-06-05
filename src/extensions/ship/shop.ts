import { Commands } from "../../lib/constants.js";
import { prisma } from "../../lib/prisma.js";
import { slashCommand } from "../slack/lib/lib.js";
import { AirtableAPI } from "./airtable.js";
import { Ship } from "./view.js";


slashCommand(Commands.SHOP, async ({ body, client }) => {
    const slackId = body.user_id;
    const channelId = body.channel_id;
    const triggerId = body.trigger_id;

    const user = await prisma.user.findFirst({
        where: {
            slackUser: {
                slackId
            }
        }
    })

    const userAirtable = await AirtableAPI.User.fetch(slackId);

    // const approvedHours = ...

    if (!user || !userAirtable) {
        await client.views.open({
            trigger_id: triggerId,
            view: await Ship.shopPreview(user.id)
        })
    } else {
        await client.views.open({
            trigger_id: triggerId,
            view: await Ship.shop(user.id)
        })
    }
})