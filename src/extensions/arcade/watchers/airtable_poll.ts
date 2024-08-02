import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { AirtableAPI } from "../../../lib/airtable.js";
import { Environment } from "../../../lib/constants.js";
import { Slack } from "../../../lib/bolt.js";
import { t } from "../../../lib/templates.js";

import Bottleneck from "bottleneck";

// Span the requests out a bit, maybe like 1 per 15 seconds
const limiter = new Bottleneck({
    minTime: 15 * 1000,
    maxConcurrent: 1
});

async function pollSyncSessions() {
    try {
        const airtableSessions = await AirtableAPI.Session.filter(`DATETIME_DIFF(NOW(), LAST_MODIFIED_TIME(), 'days') < 1`).catch(console.error);

        if (!airtableSessions) { throw new Error('Failed to fetch sessions from Airtable'); }

        for (const airtableSession of airtableSessions) {
            const record = airtableSession.id;

            console.log(`[Airtable Poll] Received session ${record} from Airtable`);
        
            const session = await prisma.session.findFirstOrThrow({
                where: {
                    metadata: {
                        path: ["airtable", "id"],
                        equals: record
                    }
                }
            });

            if (airtableSession.fields["Status"] === session.metadata.airtable?.status) {
                console.log(`[Airtable Poll] Status of session ${session.messageTs} is up to date`);
                continue;
            }

            session.metadata.airtable = {
                id: record,
                status: airtableSession.fields["Status"],
                reason: airtableSession.fields["Reason"]
            };

            await prisma.session.update({
                where: {
                    id: session.id
                },
                data: {
                    metadata: session.metadata
                }
            });

            console.log(`[Airtable Poll] Status of session ${session.messageTs} updated to ${airtableSession.fields["Status"]}`);

            // Check if it was approved & has a scrapbook
            if (airtableSession.fields["Status"] === "Approved" && airtableSession.fields["Scrapbook"].length > 0) {
                await AirtableAPI.Session.update(airtableSession.id, {
                    "Status": "Banked"
                });

                // session.metadata.airtable!.status = "Banked";

                await prisma.session.update({
                    where: {
                        id: session.id
                    },
                    data: {
                        metadata: session.metadata
                    }
                });

                console.log(`[Airtable Poll] Queued session ${session.messageTs} for banking`);
            }

            const slackUser = await prisma.slackUser.findUniqueOrThrow({
                where: {
                    userId: session.userId
                },
                select: {
                    slackId: true
                }
            });

            const permalink = await limiter.schedule(() => Slack.chat.getPermalink({
                channel: Environment.MAIN_CHANNEL,
                message_ts: session.messageTs
            }));

            if (!permalink || !permalink.permalink) { throw new Error(`No permalink found for ${session.messageTs}`); }

            // Send a message in that thread saying it was updated
            if (session.metadata.airtable!.status === "Approved") {
                limiter.schedule(() => Slack.chat.postMessage({
                    channel: Environment.MAIN_CHANNEL,
                    thread_ts: session.messageTs,
                    text: t('airtable.approved', {
                        slackId: slackUser.slackId,
                        minutes: airtableSession.fields['Approved Minutes']
                    })
                }));
            } else if (
                session.metadata.airtable!.status === "Rejected"
            ) {
                limiter.schedule(() => Slack.chat.postMessage({
                    channel: Environment.MAIN_CHANNEL,
                    thread_ts: session.messageTs,
                    text: t('airtable.rejected', {
                        slackId: slackUser.slackId
                    })
                }));
            } else if (
                session.metadata.airtable!.status === "Rejected Locked"
            ) {
                limiter.schedule(() => Slack.chat.postMessage({
                    channel: Environment.MAIN_CHANNEL,
                    thread_ts: session.messageTs,
                    text: t('airtable.rejectedlocked', {
                        slackId: slackUser.slackId
                    })
                }));
            }
        }
    } catch (error) {
        console.error(`[Airtable Poll] ${error}`);
    }
}

async function main() {
    pollSyncSessions();
    await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 60));
    main();
}

main();