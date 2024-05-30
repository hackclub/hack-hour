import { Session } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { app } from "../../../lib/bolt.js";
import { Environment } from "../../../lib/constants.js";

export class Verify {
	public static async verifyAlert(session: Session) {
		// Prefetch data
		const slackUser = await prisma.slackUser.findUnique({
			where: {
				userId: session.userId
			}
		});

		if (!session.metadata) {
			throw new Error('Session metadata is missing');
		}

		const metadata: any = session.metadata;
		const work = metadata.work;

		const permalink = (await app.client.chat.getPermalink({
			channel: Environment.MAIN_CHANNEL,
			message_ts: session.messageTs
		})).permalink;

		return [{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": session.completed ? `*User <@${slackUser?.slackId}> finished working on:*` : `*User <@${slackUser?.slackId}> cancelled working on:*`
			}
		}, {
			"type": "divider"
		}, {
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": work
			}
		}, {
			"type": "divider"
		}, {
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": `<${permalink}|View Thread>. React with :white_check_mark: on the session to verify it.\n`
			}
		}];
	}

	public static async completeVerify(session: Session) {
		// Prefetch data
		const slackUser = await prisma.slackUser.findUnique({
			where: {
				userId: session.userId
			}
		});

		if (!session.metadata) {
			throw new Error('Session metadata is missing');
		}

		const metadata: any = session.metadata;
		const work = metadata.work;

		const permalink = (await app.client.chat.getPermalink({
			channel: Environment.MAIN_CHANNEL,
			message_ts: session.messageTs
		})).permalink;

		return [{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": `*Session of <@${slackUser?.slackId}> verified!*`
			}
		}, {
			"type": "divider"
		}, {
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": `<${permalink}|View Thread>\n`
			}
		}];
	}
}
