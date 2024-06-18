import getUrls from "get-urls";
import { app, Slack } from "../../../lib/bolt.js";
import { Environment } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { updateTopLevel } from "../../slack/lib/lib.js";
import { randomChoice } from "../../../lib/templates.js";

export const fetchEvidence = async (messageTs: string, slackId: string) => {
    // Check if the user posted anything in the thread
    const evidence = await Slack.conversations.replies({
        channel: Environment.MAIN_CHANNEL,
        ts: messageTs
    });

    if (!evidence || !evidence.messages) { throw new Error(`No evidence found for ${messageTs}`); }

    const activity = evidence.messages.filter(message => message.user === slackId).length > 0;

    // Borrowed from david's code, thanks david!
    const urlsExist = evidence.messages.find(message => message.user === slackId && (getUrls(message.text ? message.text : "").size > 0))
    const imagesExist = evidence.messages.find(message => message.user === slackId && (message.files ? message.files.length > 0 : false))

    const evidenced = urlsExist !== undefined || imagesExist !== undefined;

    return { activity, evidenced };
}

const acceptedImageTypes = [
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/jpg"
]

// Take any media sent in the thread and attach it to the session
export const surfaceEvidence = async (messageTs: string, slackId: string) => {
    const evidence = await Slack.conversations.replies({
        channel: Environment.MAIN_CHANNEL,
        ts: messageTs
    });

    if (!evidence || !evidence.messages) { throw new Error(`No evidence found for ${messageTs}`); }

    const image = (evidence.messages.filter(message => message.user === slackId && (message.files ? message.files.length > 0 : false))).at(-1);

    // attach the evidence to the session
    if (image?.files && image.files.length > 0) {
        const session = await prisma.session.findFirstOrThrow({
            where: {
                messageTs: messageTs
            }
        });

        if (session.cancelled || session.completed) {
            return;
        }

        console.log(image.files[0]);

        if (acceptedImageTypes.includes(image.files[0]?.mimetype ?? "")) {
            session.metadata.slack.attachment = image.files[0]?.permalink;
        }

        const updatedSession = await prisma.session.update({
            where: {
                id: session.id
            },
            data: {
                metadata: session.metadata
            }
        });

        console.log(`woah, pretty picture! ${image.files[0]?.permalink}`)

        await updateTopLevel(updatedSession);
    }
};