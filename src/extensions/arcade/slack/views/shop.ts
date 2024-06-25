import { View } from "@slack/bolt";
import { Actions, Environment } from "../../../../lib/constants.js";

export class Shop {
    public static shop({
        recordId,
        spendable,
        awaitingApproval,
        inOrders,
        spent,
        verification
        // lifetime,
        // lifetimeTickets
    }: {
        recordId: string,
        spendable: number,
        awaitingApproval: number,
        inOrders: number,
        spent: number,
        verification: string 
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
                // {
                //     "type": "image",
                //     "image_url": "https://cloud-44iflv7n5-hack-club-bot.vercel.app/0welcome_to_the_shop_.gif",
                //     "alt_text": "the shop"
                // },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `welcome to the shop, fellow hacker! here is where you can find some cool wares, and purchase them in exchange for your tickets and scraps.
                        
*You have ${spendable} ticket${spendable == 1 ? '' : 's'} to spend.* :tw_admission_tickets:

_How do I get tickets?_\n- Provide <https://hackclub.slack.com/canvas/C077TSWKER0?focus_section_id=temp:C:CFA436b1a9e625e4b40b87a9387b|scraps> for every session.\n- *When your project is complete,* post a demo to <#C01504DCLVD> for review.\n- If your project gets approved, your hours become tickets! Be patient and keep hacking.

*Reviews rejected for reasons covered in the <https://hackclub.slack.com/canvas/C077TSWKER0|FAQ> will cost you one ticket!* So make sure you _post valid scraps_ and _ship_ _completed projects_.`
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
                        "text": `*Hours awaiting approval:* ${awaitingApproval}`
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `*Tickets spent:* ${spent + inOrders}`
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
                            "url": verification ? `${Environment.SHOP_URL}/arcade/${recordId}/shop/` : `https://forms.hackclub.com/eligibility`,
                            "action_id": Actions.NO_ACTION,
                            "style": "primary"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "view sessions",
                                "emoji": true
                            },
                            "action_id": Actions.SESSIONS,
                        }                        
                    ]
                },
                // {
                //     "type": "context",
                //     "elements": [
                //         {
                //             "type": "image",
                //             "image_url": "https://ca.slack-edge.com/T0266FRGM-U078MRX71TJ-3d58d506d2ee-512",
                //         },
                //         {
                //             "type": "mrkdwn",
                //             "text": "_it's your one stop shop!_"
                //         }
                //     ]
                // }
            ]
        };
    }
}