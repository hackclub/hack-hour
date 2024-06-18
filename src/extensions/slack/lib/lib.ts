import { Prisma } from "@prisma/client";
import { Constants, Environment } from "../../../lib/constants.js";

import { app, Slack } from "../../../lib/bolt.js";
import { prisma } from "../../../lib/prisma.js";
import { t } from "../../../lib/templates.js";

import { Controller } from "../views/controller.js";
import { TopLevel } from "../views/topLevel.js";
import { AllMiddlewareArgs, Middleware, SlackCommandMiddlewareArgs } from "@slack/bolt";
import { StringIndexed } from "@slack/bolt/dist/types/helpers.js";
import { handleError } from "../../../lib/handleError.js";

export type Session = Prisma.SessionGetPayload<{}>;

export async function updateController(session: Session) {
    await Slack.chat.update({
        ts: session.controlTs,
        channel: Environment.MAIN_CHANNEL,
        blocks: await Controller.panel(session),
        text: `Time Remaining: ${session.time-session.elapsed} minutes - ${(() => {
            if (session.paused) {
                return "Paused";
            } else if (session.cancelled) {
                return "Cancelled";
            } else if (session.completed) {
                return "Completed";
            } else {
                return "In Progress";
            }
        })()}` // TODO: Replace with accessibility friendly text
    });
}

export async function updateTopLevel(session: Session) {
    // Only update the top level if the session contains the metadata
    if (!session.metadata) {
        return;
    }
    const blocks = await TopLevel.topLevel(session);

    await Slack.chat.update({
        ts: session.messageTs,
        channel: Environment.MAIN_CHANNEL,
        blocks: blocks,
        text: `${(session.metadata as any).work}` // TODO: Replace with accessibility friendly text
    });
}

export async function fetchSlackId(userId: string) {
    const slackUser = await prisma.slackUser.findFirst({
        where: {
            user: {
                id: userId
            }
        }
    });

    if (!slackUser) {
        throw new Error(`Could not find slack user for ${userId}`);
    }

    return slackUser.slackId;
}

// Function that sends an ephemeral message to the user if able, if not, DMs the user
export async function informUser(slackId: string, message: string, channel: string, thread_ts: undefined | string = undefined, pfp: string | undefined = undefined) {
    try {
        await app.client.chat.postEphemeral({
            user: slackId,
            channel,
            text: message,
            thread_ts,
            username: Constants.USERNAME,
            icon_emoji: pfp
        });
    } catch (error) {
        const response = (error as any).data;

        await app.client.chat.postEphemeral({
            user: slackId,
            channel: slackId,
            thread_ts,
            text: message,
            username: Constants.USERNAME,
            icon_emoji: pfp
        });

        if (response.error !== 'channel_not_found') {
            // Error not caused by access perms
            handleError(error)
        }
    }
}

export async function informUserBlocks(slackId: string, blocks: any[], channel: string, thread_ts: undefined | string = undefined) {
    try {
        await app.client.chat.postEphemeral({
            user: slackId,
            channel,
            blocks,
            text: "Hack Hour",
            thread_ts
        });
    } catch (error) {
        const response = (error as any).data;

        await app.client.chat.postEphemeral({
            user: slackId,
            channel: slackId,
            thread_ts,
            text: "Hack Hour",
            blocks
        });

        if (response.error !== 'channel_not_found') {
            // Error not caused by access perms
            handleError(error)
        }
    }
    
}