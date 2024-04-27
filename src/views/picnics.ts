import { View } from "@slack/bolt";
import { Picnics } from "../subroutines/events/picnics.js";
import { prisma } from "../app.js";

export const Callbacks = {
    PICNIC: "picnic",
}

export const Actions = {
    SELECT: 'selectPicnic'
}
                
export class Views {
    public static async picnics(slackId: string): Promise<View> {
        return {
            "callback_id": Callbacks.PICNIC,
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "Picnics",
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
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Sorry, Picnics/Events are not configurable right now during the Power Hour event."
                    }
                }
            ]
        }
    }
    /*
    public static async picnics(slackId: string): Promise<View> {
        const userData = await prisma.user.findUnique({
            where: {
                slackId
            }
        });

        const event = userData?.eventId;

        const options: any[] = Picnics.map((picnic) => {
            return {
                "text": {
                    "type": "mrkdwn",
                    "text": picnic.NAME,
                },
                "description": {
                    "type": "mrkdwn",
                    "text": picnic.DESCRIPTION                
                },
                "value": picnic.ID
            }
        });


        let selectedOption: any = {
            "text": {
                "type": "mrkdwn",
                "text": `*None*`,
            },
            "description": {
                "type": "mrkdwn",
                "text": "No picnic selected"
            },
            "value": "none"
        }

        for (const picnic of Picnics) {
            if (picnic.ID === event) {
                selectedOption = options.find((option) => option.value === picnic.ID);
            }
        }

        options.unshift({
            "text": {
                "type": "mrkdwn",
                "text": `*None*`,
            },
            "description": {
                "type": "mrkdwn",
                "text": "No picnic selected"
            },
            "value": "none"
        })
                        
        return {
            "callback_id": Callbacks.PICNIC,       
            "type": "modal",
            "submit": {
                "type": "plain_text",
                "text": "Select",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Close",
                "emoji": true
            },
            "title": {
                "type": "plain_text",
                "text": "Picnics",
                "emoji": true
            },
            "blocks":[
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "Join a picnic:",
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Section block with radio buttons"
                    },
                    "accessory": {
                        "type": "radio_buttons",
                        "initial_option": selectedOption,
                        "options": options,
                        "action_id": Actions.SELECT
                    },
                    "block_id": "picnic"
                }
            ]
        }    
    }*/

    public static async error(message: string): Promise<View> {
        return {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "Error",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Close",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": message
                    }
                }
            ]
        }
    }
}