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

        console.log(`Received session ${record} from Airtable`);

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

        res.sendStatus(200);
    } catch (error) {
        emitter.emit('error', error);
    }
});

//express.post('/airtable/fullfillment'