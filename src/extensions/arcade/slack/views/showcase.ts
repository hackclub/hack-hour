import { View } from "@slack/bolt"
import { Actions, Environment } from "../../../../lib/constants.js"

export class Showcase {
    public static showcase({ loginLink }: {
        loginLink: string
    }): View {
        return {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "arcade showcase!",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "bai!!",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "it's showcase time! :DD",
                                "emoji": true
                            },
                            "url": loginLink,
                            "action_id": Actions.NO_ACTION,
                            "style": "primary"
                        },
                    ]
                },
            ]
        }
    }
}