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
        // Post a list of sessions (each with an approve & reject button)
    }

    public static async handleSessionApproveButton({ body, respond }) {
        // Updates the session in Airtable to be approved
        // Updates the scrapbook thread in slack to remove buttons & say it was approved
        // If no more sessions to review, runs handleFinishedReview()
    }

    public static async handleSessionRejectButton({ body, respond }) {
        // same as handleSessionApproveButton, but reject

    }

    public static async handleFinishedReview({ body, respond }) {
        // if rejected sessions, post instructions about re-review
        // if reviewer hasn't posted a message in the thread, post a reminder
        // post a link to "Next review" or "Stop reviewing", only visible to reviewer

    }

}

Slack.action(Actions.START_REVIEW, async ({ body, respond }) => {
    const ts = (body as any).message.ts!;
});