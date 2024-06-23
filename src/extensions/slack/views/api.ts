import { View } from "@slack/bolt";

export class API {
    public static api(key: string): View {
        return {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "your api key",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "close",
                "emoji": true
            },
            "blocks": [
                // {
                //     "type": "input",
                //     "element": {
                //         "type": "plain_text_input",
                //         "action_id": "plain_text_input-action",
                //         "initial_value": key,
                //         "placeholder": {
                //             "type": "plain_text",
                //             "text": "noo where did my key go??"
                //         }
                //     },
                //     "label": {
                //         "type": "plain_text",
                //         "text": "It's your API key! Keep it secret O:",
                //         "emoji": true
                //     },
                // },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `your api key is \`${key}\`.\nthis will regenerate every time you run \`/api\`.`
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": "_shhhhh_ - keep it secret!"
                        }
                    ]
                }
            ]
        }
    }
}