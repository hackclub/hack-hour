import { Slack } from "../../../lib/bolt.js";
import { Commands } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { t } from "../../../lib/templates.js";
import { API } from "../views/api.js";
import { scryptSync } from "crypto";

Slack.command(Commands.API, async ({ body, respond }) => {
    const slackUser = await prisma.slackUser.findUnique({
        where: {
            slackId: body.user_id,
        },
    });

    if (!slackUser) {
        await respond({
            response_type: 'ephemeral',
            text: t('error.not_a_user'),
        });
        
        return;
    }

    const apiKey = crypto.randomUUID();

    const user = await prisma.user.update({
        where: {
            id: slackUser.userId,
        },
        data: {
            apiKey: scryptSync(apiKey, 'salt', 64).toString('hex'),
        }
    });

    await Slack.views.open({
        trigger_id: body.trigger_id,
        view: API.api(user.apiKey),
    });
});