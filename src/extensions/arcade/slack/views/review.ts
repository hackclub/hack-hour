import { KnownBlock } from "@slack/bolt";
import { Actions } from "../../../../lib/constants.js";

export class ReviewView {
    public static reviewStart(): KnownBlock[] {
        return [
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
                    "action_id": Actions.START_REVIEW
                }
            }
        ];
    }
}