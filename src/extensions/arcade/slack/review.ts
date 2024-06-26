import { AirtableScrapbookRead } from "../../../lib/airtable.js";
import { Slack } from "../../../lib/bolt.js";
import { Environment } from "../../../lib/constants.js";
import { t } from "../../../lib/templates.js";

export class Review {
    public static async init(scrapbook: AirtableScrapbookRead) {
        const review = await Slack.chat.postMessage({
            channel: Environment.REVIEW_CHANNEL,
            text: t('loading'),
        });
        
        return review;
    }

    public static async open() {
        
    }
}