import { View } from "@slack/bolt";

export class API {
    public static async api(key: string): Promise<View> {
        return {
            "title": {
                "type": "plain_text",
                "text": "your api key",
                "emoji": true
            },
            "submit": {
                "type": "plain_text",
                "text": "Submit",
                "emoji": true
            },
            "type": "modal",
            "close": {
                "type": "plain_text",
                "text": "Cancel",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "input",
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "plain_text_input-action"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "It's your API key! Keep it secret O:",
                        "emoji": true
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": "_shhhhh_"
                        }
                    ]
                }
            ]
        }
    }
}