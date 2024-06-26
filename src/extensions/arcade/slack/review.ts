import { KnownBlock } from "@slack/bolt";
import { AirtableAPI, AirtableScrapbookRead } from "../../../lib/airtable.js";
import { Slack } from "../../../lib/bolt.js";
import { Actions, Environment } from "../../../lib/constants.js";
import { t } from "../../../lib/templates.js";
import { ReviewView } from "./views/review.js";

export class Review {
    public static async init(recordId: string) {
        const review = await Slack.chat.postMessage({
            channel: Environment.REVIEW_CHANNEL,
            text: t('loading'),
        });

        await AirtableAPI.Scrapbook.update(recordId, {
            "Review TS": review?.ts
        });

        await Slack.chat.update({
            channel: Environment.REVIEW_CHANNEL,
            ts: review!.ts!,
            blocks: ReviewView.reviewStart()
        });

        // update the "review channel" post with a review button
            // pressing the button triggers handleStartButton()
            // post in scrapbook thread "review has been started by"
            // post in scrapbook thread "list of sessions + approve/reject buttons"
    }

    // public static async handleStartButton({ body, respond }) {
    //     // Tells the user in the scrapbook post that someone has started the review
    //     // Post a list of sessions (each with an approve & reject button)
    // }

    // public static async handleSessionApproveButton({ body, respond }) {
    //     // Updates the session in Airtable to be approved
    //     // Updates the scrapbook thread in slack to remove buttons & say it was approved
    //     // If no more sessions to review, runs handleFinishedReview()
    // }

    // public static async handleSessionRejectButton({ body, respond }) {
    //     // same as handleSessionApproveButton, but reject

    // }

    // public static async handleFinishedReview({ body, respond }) {
    //     // if rejected sessions, post instructions about re-review
    //     // if reviewer hasn't posted a message in the thread, post a reminder
    //     // post a link to "Next review" or "Stop reviewing", only visible to reviewer

    // }

}

Slack.action(Actions.START_REVIEW, async ({ body, respond }) => {
    const ts = (body as any).message.ts!;

    const records = await AirtableAPI.Scrapbook.filter(`{Review TS} = '${ts}'`);

    if (records.length !== 1) {
        console.error(`Record not found for ts: ${ts}`);

        respond({
            text: 'Record not found. Please try again.',
            response_type: 'ephemeral'
        });

        return;
    }

    const scrapbook = records[0];

    await Slack.chat.postMessage({
        channel: Environment.SCRAPBOOK_CHANNEL,
        text: `<@${body.user.id}> has started the review.`,
        thread_ts: scrapbook.fields['Scrapbook TS']
    });

    await Slack.chat.update({
        channel: Environment.REVIEW_CHANNEL,
        ts,
        blocks: [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `Review started by <@${body.user.id}>. <${scrapbook.fields['Scrapbook URL']}|View in Scrapbook>`
                }
            },
        ]
    });

    for (const sessionId of scrapbook.fields['Sessions']) {
        const session = await AirtableAPI.Session.find(sessionId);

        if (!session) {
            console.error(`Session not found: ${sessionId}`);

            await Slack.chat.postMessage({
                channel: Environment.REVIEW_CHANNEL,
                text: `Session not found: ${sessionId}`
            });

            continue;
        }

        console.log(ReviewView.session({
            createdAt: session.fields['Created At'],
            minutes: session.fields['Minutes'],
            text: session.fields['Work'],
            link: session.fields['Code URL'],
            recId: session.id
        }));

        await Slack.chat.postMessage({
            channel: Environment.REVIEW_CHANNEL,
            text: `Review session`,
            blocks: ReviewView.session({
                createdAt: session.fields['Created At'],
                minutes: session.fields['Minutes'],
                text: session.fields['Work'],
                link: session.fields['Code URL'],
                recId: session.id
            })
        });
    }
});

Slack.action(Actions.APPROVE, async ({ body, respond }) => {
    const sessionId = (body as any).actions[0].value;

    const session = await AirtableAPI.Session.find(sessionId);

    if (!session) {
        console.error(`Session not found: ${sessionId}`);
        return;
    }

    await AirtableAPI.Session.update(sessionId, {
        "Status": "Approved"
    });

    await Slack.chat.update({
        channel: Environment.REVIEW_CHANNEL,
        ts: (body as any).message.ts!,
        blocks: [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `Approved by <@${body.user.id}>`
                }
            },
        ]
    });

    if (session.fields['Scrapbook'].length !== 1) {
        respond({
            text: 'Scrapbook not found.',
            response_type: 'ephemeral'
        });

        return;
    }

    const scrapbook = await AirtableAPI.Scrapbook.find(session.fields['Scrapbook'][0]);

    if (!scrapbook) {
        console.error(`Scrapbook not found: ${session.fields['Scrapbook'][0]}`);
        respond({
            text: 'Scrapbook not found.',
            response_type: 'ephemeral'
        });
        return;
    }

    if (scrapbook.fields['Count Approved Sessions'] === scrapbook.fields['Linked Sessions Count']) {
        await AirtableAPI.Scrapbook.update(scrapbook.id, {
            "Approved": true
        });

        await Slack.chat.postMessage({
            channel: Environment.SCRAPBOOK_CHANNEL,
            text: `All sessions approved. <@${body.user.id}>`,
            thread_ts: scrapbook.fields['Scrapbook TS']
        });
    }
});

Slack.action(Actions.REJECT, async ({ body, respond }) => {
    const sessionId = (body as any).actions[0].value;

    const session = await AirtableAPI.Session.find(sessionId);

    if (!session) {
        console.error(`Session not found: ${sessionId}`);
        return;
    }

    await AirtableAPI.Session.update(sessionId, {
        "Status": "Rejected"
    });

    await Slack.chat.update({
        channel: Environment.REVIEW_CHANNEL,
        ts: (body as any).message.ts!,
        blocks: [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `Rejected by <@${body.user.id}>`
                }
            },
        ]
    });

    if (session.fields['Scrapbook'].length !== 1) {
        respond({
            text: 'Scrapbook not found.',
            response_type: 'ephemeral'
        });

        return;
    }

    const scrapbook = await AirtableAPI.Scrapbook.find(session.fields['Scrapbook'][0]);

    if (!scrapbook) {
        console.error(`Scrapbook not found: ${session.fields['Scrapbook'][0]}`);
        respond({
            text: 'Scrapbook not found.',
            response_type: 'ephemeral'
        });
        return;
    }

    if (scrapbook.fields['Count Approved Sessions'] === scrapbook.fields['Linked Sessions Count']) {
        await AirtableAPI.Scrapbook.update(scrapbook.id, {
            "Approved": true
        });

        await Slack.chat.postMessage({
            channel: Environment.SCRAPBOOK_CHANNEL,
            text: `All sessions approved. <@${body.user.id}>`,
            thread_ts: scrapbook.fields['Scrapbook TS']
        });
    }    
});

Slack.action(Actions.REJECT_LOCK, async ({ body, respond }) => {
    const sessionId = (body as any).actions[0].value;

    const session = await AirtableAPI.Session.find(sessionId);

    if (!session) {
        console.error(`Session not found: ${sessionId}`);
        return;
    }

    await AirtableAPI.Session.update(sessionId, {
        "Status": "Rejected Locked",
    });

    await Slack.chat.update({
        channel: Environment.REVIEW_CHANNEL,
        ts: (body as any).message.ts!,
        blocks: [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `Rejected & Locked by <@${body.user.id}>`
                }
            },
        ]
    });

    if (session.fields['Scrapbook'].length !== 1) {
        respond({
            text: 'Scrapbook not found.',
            response_type: 'ephemeral'
        });

        return;
    }

    const scrapbook = await AirtableAPI.Scrapbook.find(session.fields['Scrapbook'][0]);

    if (!scrapbook) {
        console.error(`Scrapbook not found: ${session.fields['Scrapbook'][0]}`);
        respond({
            text: 'Scrapbook not found.',
            response_type: 'ephemeral'
        });
        return;
    }

    if (scrapbook.fields['Count Approved Sessions'] === scrapbook.fields['Linked Sessions Count']) {
        await AirtableAPI.Scrapbook.update(scrapbook.id, {
            "Approved": true
        });

        await Slack.chat.postMessage({
            channel: Environment.SCRAPBOOK_CHANNEL,
            text: `All sessions approved. <@${body.user.id}>`,
            thread_ts: scrapbook.fields['Scrapbook TS']
        });
    }
});