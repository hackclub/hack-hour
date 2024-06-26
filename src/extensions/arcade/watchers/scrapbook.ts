import { express, Slack } from "../../../lib/bolt.js";
import { prisma, uid } from "../../../lib/prisma.js";
import { AirtableAPI } from "../../../lib/airtable.js";
import { app } from "../../../lib/bolt.js";
import { ChooseSessions } from "../slack/views/scrapbook.js";
import { log } from "../lib/log.js";
import { Environment } from "../../../lib/constants.js";
import { emitter } from "../../../lib/emitter.js";
import { t } from "../../../lib/templates.js";

// {
//     "messageText": "wait wait",
//     "postTime": "1718625301.339709",
//     "attachments": [
//         "https://scrapbook-into-the-redwoods.s3.amazonaws.com/b4c10aee-e734-4b7c-ba9e-c384a177b682-img_3780.jpg"
//     ],
//     "user": {
//         "slackID": "U04QD71QWS0",
//         "name": "manitej"
//     },
//     "channel": "C063RPGKRL2"
// }

express.post("/scrapbook/post", async (req, res) => {
    try {
        // 1. Send a DM to the user so they can select which sessions go to their scrapbook post
        // 2. Add an entry to the airtable to represent the scrapbook post
        // 3. Mark sessions associated with the scrapbook post (& are approved) as "banked"
        // 4. Send a confirmation message to the user

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

        const slackId: string = req.body.user.slackID;
        const postTime: string = req.body.postTime;
        const attachments: string[] = req.body.attachments;
        const channel: string = req.body.channel;

        const scrapbookUrl = await Slack.chat.getPermalink({
            channel,
            message_ts: postTime,
        });

        if (!scrapbookUrl || !scrapbookUrl.permalink) { throw new Error(`No permalink found for ${postTime}`); }

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
                            "text": `<${scrapbookUrl.permalink}|post> by <@${slackId}> in <#${channel}>`
                        }
                    ]
                }
            ]
        });

        const user = await prisma.user.findFirst({
            where: {
                slackUser: {
                    slackId,
                },
            },
            select: {
                id: true,
                metadata: true,
            },
        });

        // If they aren't a user, just skip
        if (!user) {
            return;
        }

        if (!(user.metadata as any).airtable) {
            throw new Error(`Airtable user not found for ${user.id}`);
        }

        const { id } = await AirtableAPI.Scrapbook.create({
            "Scrapbook TS": req.body.postTime,
            "Scrapbook URL": scrapbookUrl.permalink!,
            User: [(user.metadata as any).airtable?.id],
            Sessions: [],
            Attachments: req.body.attachments.map((url: string) => ({ url })),
            Text: req.body.messageText,
            Reviewer: [],
        });

        const flowMsg = await Slack.chat.postMessage({
            channel: slackId,
            text: t('loading'),
        });

        if (!flowMsg || !flowMsg.ts) {
            await Slack.chat.postMessage({
                channel: slackId,
                text: t(`error.generic`),
            });
            throw new Error("No ts found for flow message");
        }

        const scrapbook = await prisma.scrapbook.create({
            data: {
                internalId: uid(),
                ts: postTime,

                flowTs: flowMsg.ts,
                flowChannel: flowMsg.channel!,

                channel,
                user: {
                    connect: {
                        id: user.id,
                    },
                },
                data: {
                    attachments,
                    record: id
                },
            },
        });

        await app.client.chat.update({
            channel: flowMsg.channel!,
            ts: flowMsg.ts,
            text: t('scrapbook.prompt.select_sessions'),
            blocks: ChooseSessions.chooseSessionsButton(scrapbook.internalId),
        });

        res.status(200).send("Success");
    } catch (error) {
        emitter.emit("error", error);
    }
});

// app.event("message", async ({ event }) => {
//     if (event.channel !== Environment.SCRAPBOOK_CHANNEL) { return; }
//     if ((event as any).thread_ts) { return; }

//     // 1. Send a DM to the user so they can select which sessions go to their scrapbook post
//     // 2. Add an entry to the airtable to represent the scrapbook post
//     // 3. Mark sessions associated with the scrapbook post (& are approved) as "banked"
//     // 4. Send a confirmation message to the user

//     // console.log(`Recieved request to post to scrapbook: ${JSON.stringify(req.body)} - Thanks scrappy!`);
//     // log(`Recieved request to post to scrapbook: ${JSON.stringify(req.body)} - Thanks scrappy!`);

//     // const slackId: string = req.body.slackId;
//     // const postTime: string = req.body.postTime;
//     // const attachments: string[] = req.body.attachments;
//     // const channel: string = req.body.channel;
//     console.log(JSON.stringify(event));
//     log(JSON.stringify(event));
//     return;

//     const slackId: string = (event as any).user;
//     const postTime: string = event.ts;
//     const attachments: string[] = (event as any).attachments;
//     const channel: string = event.channel;

//     const user = await prisma.user.findFirstOrThrow({
//         where: {
//             slackUser: {
//                 slackId,
//             },
//         },
//         select: {
//             id: true,
//             metadata: true,
//         },
//     });

//     if (!(user.metadata as any).airtable) {
//         throw new Error(`Airtable user not found for ${user.id}`);
//     }

//     const { id } = await AirtableAPI.Scrapbook.create({
//         "Ship TS": postTime,
//         User: [(user.metadata as any).airtable?.id],
//         Sessions: [],
//         Attachments: attachments.map((url: string) => ({ url })),
//     });

//     const scrapbook = await prisma.scrapbook.create({
//         data: {
//             internalId: uid(),
//             ts: postTime,
//             channel,
//             user: {
//                 connect: {
//                     id: user.id,
//                 },
//             },
//             data: {
//                 attachments,
//                 record: id
//             },
//         },
//     });



//     await app.client.chat.postMessage({
//         channel: slackId,
//         text: "Select which sessions should be linked to your scrapbook post.",
//         blocks: ChooseSessions.chooseSessionsButton(scrapbook.internalId),
//     });
// });
