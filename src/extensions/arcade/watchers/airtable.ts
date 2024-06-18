import { app, express, Slack } from "../../../lib/bolt.js";
import { AirtableAPI } from "../../../lib/airtable.js";
import { prisma } from "../../../lib/prisma.js";
import { Environment } from "../../../lib/constants.js";
import { log } from "../lib/log.js";
import { t } from "../../../lib/templates.js";
import { handleError } from "../../../lib/handleError.js";

express.post('/airtable/session/update', async (req, res) => {
    try {
        const { record } = req.body;

        const airtableSession = await AirtableAPI.Session.find(record);

        if (!airtableSession) {
            throw new Error(`No session found for ${record}`);
        }

        console.log(`Received session ${record} from Airtable`);

        const logData = await app.client.chat.postMessage({
            channel: Environment.INTERNAL_CHANNEL,
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `> _oh haii scrappy!_ :scrappy:`
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": `view thread to see post body :eyes:\n${new Date().toString()}`
                        }
                    ]
                }
            ]
        });

        const session = await prisma.session.findFirstOrThrow({
            where: {
                metadata: {
                    path: ["airtable", "id"],
                    equals: record
                }
            }
        });

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

        console.log(`Status of session ${session.messageTs} updated to ${airtableSession.fields["Status"]}`);
        log(`Status of session ${session.messageTs} updated to ${airtableSession.fields["Status"]}`);

        // Check if it was approved & has a scrapbook
        if (airtableSession.fields["Status"] === "Approved" && airtableSession.fields["Scrapbook"].length > 0) {
            await AirtableAPI.Session.update(airtableSession.id, {
                "Status": "Banked"
            });

            session.metadata.airtable!.status = "Banked";

            await prisma.session.update({
                where: {
                    id: session.id
                },
                data: {
                    metadata: session.metadata
                }
            });

            console.log(`Queued session ${session.messageTs} for banking`);
            log(`Queued session ${session.messageTs} for banking`);
        }

        const slackUser = await prisma.slackUser.findUniqueOrThrow({
            where: {
                userId: session.userId
            },
            select: {
                slackId: true
            }
        });

        const permalink = await Slack.chat.getPermalink({
            channel: Environment.MAIN_CHANNEL,
            message_ts: session.messageTs
        });

        if (!permalink || !permalink.permalink) { throw new Error(`No permalink found for ${session.messageTs}`); }

        await app.client.chat.postMessage({
            channel: Environment.INTERNAL_CHANNEL,
            thread_ts: logData.ts!,
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `\`\`\`${JSON.stringify(req.body, null, 4)}\`\`\``
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": `<${permalink.permalink}|session> of <@${slackUser.slackId}>`
                        }
                    ]
                }
            ]
        });        

        // Send a message in that thread saying it was updated
        if (session.metadata.airtable!.status === "Approved") {
            await Slack.chat.postMessage({
                channel: Environment.MAIN_CHANNEL,
                thread_ts: session.messageTs,
                text: t('airtable.approved', {
                    slackId: slackUser.slackId
                })
            });
        } else if (session.metadata.airtable!.status === "Rejected") {
            await Slack.chat.postMessage({
                channel: Environment.MAIN_CHANNEL,
                thread_ts: session.messageTs,
                text: t('airtable.rejected', {
                    slackId: slackUser.slackId
                })
            });
        }

        res.sendStatus(200);
    } catch (error) {
        handleError(error);
    }
});

//express.post('/airtable/fullfillment'