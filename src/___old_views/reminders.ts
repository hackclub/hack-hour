import { prisma } from "../app.js";
import { View } from "@slack/bolt";

export const Callbacks = {
    REMINDERS: 'reminders',
}

export class Views {
    public static async reminders(userId: string): Promise<View> {
        const userData = await prisma.user.findUnique({
            where: {
                slackId: userId
            }
        });

        if (!userData) {
            throw new Error("User not found");
        }

        return {
            "type": "modal",
            "callback_id": Callbacks.REMINDERS,
            "title": {
                "type": "plain_text",
                "text": "Reminders",
                "emoji": true
            },
            "submit": {
                "type": "plain_text",
                "text": "Submit",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Cancel",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "input",
                    "element": {
                        "type": "timepicker",
                        "action_id": "reminder_time",
                        "initial_time": userData?.reminder ?? "15:00",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Select a time"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "What time would you like to be reminded to hack hour?"
                    },
                    "block_id": "reminder"
                }
            ]
        };
    }
}