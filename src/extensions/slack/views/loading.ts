import { KnownBlock, View } from "@slack/bolt";

export class Loading {
    public static message(): KnownBlock[] {
        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `Loading... :spin-loading:`
                }
            }
        ]
    }

    public static view(): View {
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
                        "text": `Loading... :spin-loading:`
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