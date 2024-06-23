import { View } from "@slack/bolt";
import { t } from "../../../lib/templates.js";

export class Loading {
    public static loading(): View {
        return {
            "type": "modal",
            "close": {
                "type": "plain_text",
                "text": "Close",
                "emoji": true
            },
            "title": {
                "type": "plain_text",
                "text": "Loading...",
                "emoji": true
            },
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": t('loading')
                    }
                }
            ]
        };
    }

    public static error(message: string): View {
        return {
            "type": "modal",
            "close": {
                "type": "plain_text",
                "text": "Close",
                "emoji": true
            },
            "title": {
                "type": "plain_text",
                "text": "Error",
                "emoji": true
            },
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `:warning: ${message}`
                    }
                }
            ]
        };
    }
}