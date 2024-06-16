import getUrls from "get-urls";
import { app } from "../../../lib/bolt.js";
import { Environment } from "../../../lib/constants.js";

export const fetchEvidence = async (messageTs: string, slackId: string) => {
    // Check if the user posted anything in the thread
    const evidence = await app.client.conversations.replies({
        channel: Environment.MAIN_CHANNEL,
        ts: messageTs
    });

    if (!evidence.messages) { throw new Error(`No evidence found for ${messageTs}`); }

    const activity = evidence.messages.filter(message => message.user === slackId).length > 0;

    // Borrowed from david's code, thanks david!
    const urlsExist = evidence.messages.find(message => message.user === slackId && (getUrls(message.text ? message.text : "").size > 0))
    const imagesExist = evidence.messages.find(message => message.user === slackId && (message.files ? message.files.length > 0 : false))

    const evidenced = urlsExist !== undefined || imagesExist !== undefined;

    return { activity, evidenced };
}
