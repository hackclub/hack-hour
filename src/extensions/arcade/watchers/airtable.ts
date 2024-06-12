import { app, express } from "../../../lib/bolt.js";
import { AirtableAPI } from "../lib/airtable.js";
import { prisma } from "../../../lib/prisma.js";
import { Environment } from "../../../lib/constants.js";
import { emitter } from "../../../lib/emitter.js";
import { log } from "../lib/log.js";

express.post('/airtable/session/update', async (req, res) => {
    try {
        const { record } = req.body;

        const airtableSession = await AirtableAPI.Session.find(record);

        if (!airtableSession) {
            throw new Error(`No session found for ${record}`);
        }

        const permalink = (await app.client.chat.getPermalink({
            channel: Environment.MAIN_CHANNEL,
            message_ts: airtableSession.fields["Message TS"]
        })).permalink;

        console.log(`Received session ${record} from Airtable`);

        const session = await prisma.session.findFirstOrThrow({
            where: {
                metadata: {
                    path: ["airtable", "id"],
                    equals: record
                }
            }
        });

        // if (session.metadata.airtable?.status !== airtableSession.fields["Status"]) {
        //     if (airtableSession.fields["Status"] === "Rejected") {
        //         // Update this as an unapproved transaction
        //         await prisma.transaction.update({
        //             where: {
        //                 sessionId: session.id
        //             },
        //             data: {
        //                 approved: false
        //             }
        //         });
        //         log(`Transaction for <session|${permalink}> rejected`);
        //     } else if (airtableSession.fields["Status"] === "Approved" && airtableSession.fields["Scrapbook"].length > 0) {
        //         // Update this as an approved transaction
        //         await prisma.transaction.update({
        //             where: {
        //                 sessionId: session.id
        //             },
        //             data: {
        //                 approved: true
        //             }
        //         });
        //         log(`Transaction for <session|${permalink}> approved`);
        //     }   
        // }     

        // if (session.elapsed !== airtableSession.fields["Approved Minutes"]) {
        //     await prisma.transaction.update({
        //         where: {
        //             sessionId: session.id
        //         },
        //         data: {
        //             amount: airtableSession.fields["Approved Minutes"]
        //         }
        //     });
        //     log(`Transaction for <session|${permalink}> updated to ${airtableSession.fields["Approved Minutes"]} minutes`);
        // }

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

        res.sendStatus(200);
    } catch (error) {
        emitter.emit('error', error);
    }
});

//express.post('/airtable/fullfillment'