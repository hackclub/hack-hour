import { View } from "@slack/bolt";
import { Environment } from "../../../../lib/constants.js";

export class Shop {
    public static shop({
        recordId,
        spendable,
        awaitingApproval,
        inOrders,
        spent,
        lifetime,
        lifetimeTickets
    }: {
        recordId: string,
        spendable: number,
        awaitingApproval: number,
        inOrders: number,
        spent: number,
        lifetime: string,
        lifetimeTickets: number
    }): View {
        return {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "the shop :D",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "see ya later!",
                "emoji": true,
            },
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `welcome to the shop, fellow hacker! here is where you can find some cool wares, and purchase them in exchange for your tickets and scraps.
                        
*Tickets you can spend:* :tw_admission_tickets: ${spendable}

_How do I get tickets?_ You can get tickets once your sessions are approved (to prevent abuse) and have an approved scrapbook post attached to them.`
                    },
                    "accessory": {
                        "type": "image",
                        "image_url": "https://ca.slack-edge.com/T0266FRGM-U078MRX71TJ-3d58d506d2ee-512",
                        "alt_text": "arcadius"
                    }
                },
                {
                    "type": "divider"
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `*Tickets awaiting approval:* :tw_admission_tickets: ${awaitingApproval}`
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `*Tickets currently being proccessed for orders:* :tw_admission_tickets: ${inOrders}`
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `*Tickets spent:* :tw_admission_tickets: ${spent}`
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `_*Lifetime Hours:* ${lifetime} hours (:tw_admission_tickets: ${lifetimeTickets} earned)_`
                    }
                },                
                {
                    "type": "divider"
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "open the shop!",
                                "emoji": true
                            },
                            "url": `${Environment.SHOP_URL}/arcade/${recordId}/shop/`,
                            "style": "primary"
                        }
                    ]
                },
            ]
        };
    }
}