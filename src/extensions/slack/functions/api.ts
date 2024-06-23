import { Slack } from "../../../lib/bolt.js";
import { Commands } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { t } from "../../../lib/templates.js";
import { API } from "../views/api.js";

Slack.command(Commands.API, async ({ body, respond }) => {
    const user = await prisma.slackUser.findUnique({
        where: {
            slackId: body.user_id,
        },
        select: {
            user: {
                select: {
                    apiKey: true,
                },
            }
        },
    });

    if (!user) {
        await respond({
            response_type: 'ephemeral',
            text: t('error.not_a_user'),
        });
        
        return;
    }

    console.log(JSON.stringify(API.api(user.user.apiKey), null, 2));
    
    await Slack.views.open({
        trigger_id: body.trigger_id,
        view: API.api(user.user.apiKey),
    });
});