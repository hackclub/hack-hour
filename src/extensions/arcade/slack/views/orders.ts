import { KnownBlock, View } from "@slack/bolt";
import { AirtableOrdersRead } from "../../../../lib/airtable.js";

export class Orders {
    public static order(orders: AirtableOrdersRead[]): View {
        const blocks: KnownBlock[] = [];

        if (orders.length === 0) {
            blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "You have no orders."
                }
            });
        } else {
            for (const order of orders) {
                blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text:
                            `*${order["Item: Name"]}*
_Status:_ ${order["Status"]}
_Quantity:_ ${order["Quantity"]}
_Price:_ ${Math.floor(order["Order Price (Minutes)"] / 60)} :tw_admission_tickets:`
                    },
                    accessory: order["Item: Image"][0] ? {
                        type: "image",
                        image_url: order["Item: Image"][0],
                        alt_text: order["Item: Name"][0],
                    } : undefined
                }, {
                    type: "divider",
                });
            }
        }

        return {
            type: "modal" as const,
            title: {
                type: "plain_text" as const,
                text: "orders",
                emoji: true,
            },
            close: {
                type: "plain_text" as const,
                text: "close",
                emoji: true,
            },
            blocks,
        };
    }
}