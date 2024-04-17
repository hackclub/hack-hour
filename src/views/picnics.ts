import { View } from "@slack/bolt";

export const Callbacks = {
    PICNIC: "picnic",
}

export class Views {
    public static picnics(): View {
        return {
            "callback_id": Callbacks.PICNIC,
            "type": "modal",
            "submit": {
                "type": "plain_text",
                "text": "Okay",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Close",
                "emoji": true
            },
            "title": {
                "type": "plain_text",
                "text": "Goals",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Picnics aren't available yet. Check back soon! 🧺"
                    }
                }
            ]
        }
    }
}