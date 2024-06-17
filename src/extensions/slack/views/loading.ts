import { View } from "@slack/bolt";

export class Loading {
    public static async loading(): Promise<View> {
        return {
            "type": "modal",
            "close": {
                "type": "plain_text",
                "text": "Close",
                "emoji": true
            },
            "title": {
                "type": "plain_text",
                "text": "Goal Selection",
                "emoji": true
            },
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Loading... :spin-loading:`
                    }
                }
            ]
        };
    }
}