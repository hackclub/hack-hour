import { app } from "../../../lib/bolt.js";
import { Environment } from "../../../lib/constants.js";

export async function log(message: string) {
    await app.client.chat.postMessage({
        channel: Environment.INTERNAL_CHANNEL,
        text: message
    });
}