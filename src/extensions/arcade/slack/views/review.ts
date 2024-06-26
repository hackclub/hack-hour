import { MessageAttachment } from "@slack/bolt";

export class ReviewViews {
    public static reviewStart(): MessageAttachment[] {
        return [
            {
                "color": "#f2c744",
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": "This is a header block",
                            "emoji": true
                        }
                    },
                    {
                        "type": "divider"
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "This is a section block with a button."
                        },
                        "accessory": {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Click Me",
                                "emoji": true
                            },
                            "value": "click_me_123",
                            "action_id": "button-action"
                        }
                    }
                ]
            }
        ]
    }
}