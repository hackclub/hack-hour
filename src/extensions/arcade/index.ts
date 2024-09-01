import "./watchers/scrapbook.js";
import "./watchers/hackhour.js"
import "./watchers/airtable.js";
import "./watchers/protected_channels.js";
import "./watchers/airtable_poll.js";

import "./slack/index.js";
import "./slack/sessions.js";
import "./slack/scrapbook.js";
import "./slack/shop.js";
import "./slack/walkthrough.js";
import "./slack/showcase.js";

import { emitter } from "../../lib/emitter.js";
import { Slack } from "../../lib/bolt.js";
import { prisma } from "../../lib/prisma.js";
import { t } from "../../lib/templates.js";
import { Environment } from "../../lib/constants.js";

emitter.on('init', () => {
    console.log('[Arcade] 🕹️ Arcade Initialized!')
})


Slack.command('/shop', async ({ command }) => {
    const user = await prisma.user.findFirst({
        where: {
            slackUser: {
                slackId: command.user_id
            }
        }
    });

    if (!user) {
        await Slack.chat.postMessage({
            channel: command.channel_id,
            text: t('error.first_time')
        });

        return;
    }

    const recordId = user.metadata.airtable?.id;

    if (!recordId) {
        await Slack.chat.postMessage({
            channel: command.channel_id,
            text: t('error.first_time')
        });

        return;
    }

    Slack.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `<${Environment.SHOP_URL}/arcade/${recordId}/shop/|Open the shop!>`
    });
});
