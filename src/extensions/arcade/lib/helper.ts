import getUrls from "get-urls";
import { app, Slack } from "../../../lib/bolt.js";
import { Environment } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { updateTopLevel } from "../../slack/lib/lib.js";
import { randomChoice } from "../../../lib/templates.js";
import { Evidence } from "./evidence.js";

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

    //const image = (evidence.messages.filter(message => message.user === slackId && (message.files ? message.files.length > 0 : false))).at(-1);
    const image = (await Evidence.grabImages(messageTs, slackId)).at(-1);

    // attach the evidence to the session
    if (image) {
        const session = await prisma.session.findFirstOrThrow({
            where: {
                messageTs: messageTs
            }
        });

        if (session.cancelled || session.completed) {
            return;
        }

        if (acceptedImageTypes.includes(image.mimetype ?? "")) {
            session.metadata.slack.attachment = image.permalink;
        }

        const updatedSession = await prisma.session.update({
            where: {
                id: session.id
            },
            data: {
                metadata: session.metadata
            }
        });

        console.log(`woah, pretty picture! ${image.permalink}`)

        await updateTopLevel(updatedSession);
    }
};