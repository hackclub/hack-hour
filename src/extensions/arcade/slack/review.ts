import { KnownBlock } from "@slack/bolt";
import { AirtableAPI, AirtableScrapbookRead } from "../../../lib/airtable.js";
import { Slack } from "../../../lib/bolt.js";
import { Actions, Environment } from "../../../lib/constants.js";
import { t } from "../../../lib/templates.js";
import { ReviewView } from "./views/review.js";

export class Review {
    public static async init(recordId: string) {
        const review = await Slack.chat.postMessage({
            channel: Environment.REVIEW_CHANNEL,
            text: t('loading'),
        });

        await AirtableAPI.Scrapbook.update(recordId, {
            "Review TS": review?.ts
        });

        await Slack.chat.update({
            channel: Environment.REVIEW_CHANNEL,
            ts: review!.ts!,
            blocks: ReviewView.reviewStart()
        });

        // update the "review channel" post with a review button
            // pressing the button triggers handleStartButton()
            // post in scrapbook thread "review has been started by"
            // post in scrapbook thread "list of sessions + approve/reject buttons"
    }

    public static async handleStartButton({ body, respond }) {
        // Tells the user in the scrapbook post that someone has started the review
        // 
    }

}

Slack.action(Actions.START_REVIEW, async ({ body, respond }) => {
    const ts = (body as any).message.ts;

    if (!ts) {
        respond({
            text: "No message found",
            response_type: "ephemeral",
        });

        return;
    }

    
});