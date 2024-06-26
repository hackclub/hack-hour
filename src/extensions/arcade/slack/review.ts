import { KnownBlock } from "@slack/bolt";
import { AirtableAPI, AirtableScrapbookRead } from "../../../lib/airtable.js";
import { Slack, app } from "../../../lib/bolt.js";
import { Actions, Environment } from "../../../lib/constants.js";
import { t } from "../../../lib/templates.js";
import { ReviewView } from "./views/review.js";
import { prisma } from "../../../lib/prisma.js";

let slackReviewerCache: string[] | undefined = [];
let reviewerCacheUpdatedTs = new Date();



async function getReviewerCache() {
    const noCache = !slackReviewerCache || slackReviewerCache.length == 0;
    const expired = new Date().getTime() - reviewerCacheUpdatedTs.getTime() > 1000 * 60 * 5; // 5 minutes
    if (noCache || expired) {
        slackReviewerCache = await Slack.conversations.members(Environment.REVIEW_CHANNEL);
        reviewerCacheUpdatedTs = new Date();
    }
    if (!slackReviewerCache) { return []; }
    return slackReviewerCache;
}

export class Review {
    public static async ensureReviewPermission(reviewerSlackId: string) {
        try {
            const [reviewers, slackUsers] = await Promise.all([
                AirtableAPI.Reviewer.filter(`AND({Slack ID} = '${reviewerSlackId}', {TEMP: Beta system} = TRUE())`),
                getReviewerCache()
            ])
 
            const reviewer = reviewers[0] || null;

            if (!reviewer) {
                console.warn(`No reviewer found with Slack ID ${reviewerSlackId}`);
                return false
            }

            if (!slackUsers || !slackUsers.includes(reviewerSlackId)) {
                console.warn(`Reviewer ${reviewerSlackId} is not in the review channel`);
                return false
            }

            // all good, continue...
            return true
        } catch(e) {
            console.error(e)
        }

    }

    public static async init(recordId: string, reviewerSlackId: string | null=null) {
        // New session to review! post in #arcade-reivew!
        // optionally if reviewerSlackId is provided, assign that reviewer instantly
        try {

            const review = await Slack.chat.postMessage({
                channel: Environment.REVIEW_CHANNEL,
                text: t('loading'),
            });

            await AirtableAPI.Scrapbook.update(recordId, { "Review TS": review?.ts });

            if (reviewerSlackId) {
                this.assignReviewer({ scrapbookID: recordId, reviewerSlackId });
            }

            const permalink = await Slack.chat.getPermalink({
                channel: Environment.REVIEW_CHANNEL,
                message_ts: review?.ts!
            });

            console.log(permalink?.permalink);

            await Slack.chat.update({
                channel: Environment.REVIEW_CHANNEL,
                ts: review!.ts!,
                blocks: ReviewView.reviewStart(permalink?.permalink!)
            });

        } catch (e) {
            console.error(e);
        }

        // update the "review channel" post with a review button
        // pressing the button triggers handleStartButton()
        // post in scrapbook thread "review has been started by"
        // post in scrapbook thread "list of sessions + approve/reject buttons"
    }

    public static async assignReviewer({ scrapbookID, reviewerSlackId }: {
        scrapbookID: string,
        reviewerSlackId: string
    }) {
        try {

            const reviewers = await AirtableAPI.Reviewer.filter(`{Slack ID} = ${reviewerSlackId}`)
            const reviewer = reviewers[0] || null;
            if (!reviewer) {
                throw new Error(`No reviewer found with Slack ID ${reviewerSlackId}`);
            }
            await AirtableAPI.Scrapbook.update(scrapbookID, {
                "Review Start Time": new Date().toISOString(),
                "Reviewer": [reviewer.id]
            });

        }
        catch (e) {
            console.error(e);
        }
    }

    public static async finishReview(scrapbookID: string) {
        try {
            const scrapbook = await AirtableAPI.Scrapbook.find(scrapbookID);

            if (!scrapbook) {
                console.error(`Scrapbook not found: ${scrapbookID}`);

                return;
            }

            if (scrapbook.fields['Count Unreviewed Sessions'] === 0) {
                await AirtableAPI.Scrapbook.update(scrapbook.id, {
                    "Approved": true
                });

                await Slack.chat.postMessage({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    text: `All sessions reviewed.`,
                    thread_ts: scrapbook.fields['Scrapbook TS']
                });

                await app.client.chat.delete({
                    channel: Environment.REVIEW_CHANNEL,
                    ts: scrapbook.fields['Review TS']
                });
            }
        } catch (e) {
            console.error(e);
        }
    }

    public static async garbageCollection(scrapbookID: string) {
        try {
            const scrapbook = await AirtableAPI.Scrapbook.find(scrapbookID);

            if (!scrapbook) {
                console.error(`Scrapbook not found: ${scrapbookID}`);

                return;
            }

            for (const sessionId of scrapbook.fields['Sessions']) {
                const session = await AirtableAPI.Session.find(sessionId);

                if (!session) {
                    console.error(`Session not found: ${sessionId}`);
                    continue;
                }

                await app.client.chat.delete({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    ts: session.fields['Review Button TS']!
                });

                await AirtableAPI.Session.update(sessionId, {
                    "Review Button TS": undefined
                });
            }

            await AirtableAPI.Scrapbook.update(scrapbook.id, {
                "Review Start Time": undefined,
                "Reviewer": [],
            });

            await Slack.chat.postMessage({
                channel: Environment.SCRAPBOOK_CHANNEL,
                text: `kicking reviewer out for being too sleepy`,
                thread_ts: scrapbook.fields['Scrapbook TS']
            });
        } catch (e) {
            console.error(e);
        }
    }

    public static async unsubmit(scrapbookID: string) {
        try {
            const scrapbook = await AirtableAPI.Scrapbook.find(scrapbookID);

            if (!scrapbook) {
                console.error(`Scrapbook not found: ${scrapbookID}`);

                return;
            }

            await Slack.chat.postMessage({
                channel: Environment.SCRAPBOOK_CHANNEL,
                text: `unsubmitting scrapbook post & unlinking all sessions`,
                thread_ts: scrapbook.fields['Scrapbook TS']
            });

            await app.client.chat.delete({
                channel: Environment.REVIEW_CHANNEL,
                ts: scrapbook.fields['Review TS']
            });

            for (const sessionId of scrapbook.fields['Sessions']) {
                const session = await AirtableAPI.Session.find(sessionId);

                if (!session) {
                    console.error(`Session not found: ${sessionId}`);
                    continue;
                }

                await app.client.chat.delete({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    ts: session.fields['Review Button TS']!
                });

                await AirtableAPI.Session.update(sessionId, {
                    "Scrapbook": [],
                    "Review Button TS": undefined,
                });

                const sessionRemove = await prisma.session.update({
                    where: {
                        id: session.fields['Session ID']
                    },
                    data: {
                        scrapbook: {
                            disconnect: true,
                        },
                        scrapbookId: undefined
                    }
                });

                console.log(sessionRemove.scrapbookId);
            }
        } catch (e) {
            console.error(e);
        }
    }
}

Slack.action(Actions.START_REVIEW, async ({ body, respond }) => {
    const slackId = body.user.id;

    if (!(await Review.ensureReviewPermission(slackId))) {
        await Slack.chat.postEphemeral({
            channel: body.channel?.id!,
            user: slackId,
            text: 'You do not have permission to start a review.',
            thread_ts: (body as any).message.ts!
        });
        return;
    }
    
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
        thread_ts: scrapbook.fields['Scrapbook TS'],
        blocks: [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `Review started by <@${body.user.id}>.`
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Unsubmit",
                        "emoji": true,
                    },
                    "action_id": Actions.UNSUBMIT,
                    "value": scrapbook.id,
                }
            },
        ]
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
                channel: Environment.SCRAPBOOK_CHANNEL,
                text: `Session not found: ${sessionId}`,
                thread_ts: scrapbook.fields['Scrapbook TS']
            });

            continue;
        }

        let button;
        if (session.fields['Status'] === 'Approved') {
            button = await Slack.chat.postMessage({
                channel: Environment.SCRAPBOOK_CHANNEL,
                thread_ts: scrapbook.fields['Scrapbook TS'],
                blocks: ReviewView.approved(sessionId)
            });
        } else if (session.fields['Status'] === 'Rejected') {
            button = await Slack.chat.postMessage({
                channel: Environment.SCRAPBOOK_CHANNEL,
                thread_ts: scrapbook.fields['Scrapbook TS'],
                blocks: ReviewView.rejected(sessionId)
            });
        } else if (session.fields['Status'] === 'Rejected Locked') {
            button = await Slack.chat.postMessage({
                channel: Environment.SCRAPBOOK_CHANNEL,
                thread_ts: scrapbook.fields['Scrapbook TS'],
                blocks: ReviewView.rejectedLock(sessionId)
            });
        } else {
            button = await Slack.chat.postMessage({
                channel: Environment.SCRAPBOOK_CHANNEL,
                text: `Review session`,
                blocks: ReviewView.session({
                    createdAt: session.fields['Created At'],
                    minutes: session.fields['Minutes'],
                    text: session.fields['Work'],
                    link: session.fields['Code URL'],
                    recId: session.id
                }),
                thread_ts: scrapbook.fields['Scrapbook TS']
            });
        }

        await AirtableAPI.Session.update(sessionId, {
            "Review Button TS": button?.ts
        });
    }
});

Slack.action(Actions.APPROVE, async ({ body, respond }) => {
    const slackId = body.user.id;

    if (!(await Review.ensureReviewPermission(slackId))) {
        await Slack.chat.postEphemeral({
            channel: body.channel?.id!,
            user: slackId,
            text: 'You do not have permission to start a review.',
            thread_ts: (body as any).message.ts!
        });
        return;
    }    

    console.log(JSON.stringify(body, null, 2))
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
        channel: Environment.SCRAPBOOK_CHANNEL,
        ts: (body as any).message.ts!,
        blocks: ReviewView.approved(sessionId, body.user.id)
    });

    if (session.fields['Scrapbook'].length === 0) {
        console.error(`Scrapbook not found for session: ${sessionId}`);

        respond({
            text: 'Scrapbook post not found in airtable.',
            response_type: 'ephemeral'
        });

        return;
    }

    await Review.finishReview(session.fields['Scrapbook'][0]);
});

Slack.action(Actions.REJECT, async ({ body, respond }) => {    
    const slackId = body.user.id;

    if (!(await Review.ensureReviewPermission(slackId))) {
        await Slack.chat.postEphemeral({
            channel: body.channel?.id!,
            user: slackId,
            text: 'You do not have permission to start a review.',
            thread_ts: (body as any).message.ts!
        });
        return;
    }

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
        channel: Environment.SCRAPBOOK_CHANNEL,
        ts: (body as any).message.ts!,
        blocks: ReviewView.rejected(sessionId, body.user.id)
    });

    if (session.fields['Scrapbook'].length === 0) {
        console.error(`Scrapbook not found for session: ${sessionId}`);

        respond({
            text: 'Scrapbook post not found in airtable.',
            response_type: 'ephemeral'
        });

        return;
    }

    await Review.finishReview(session.fields['Scrapbook'][0]);
});

Slack.action(Actions.REJECT_LOCK, async ({ body, respond }) => {
    const slackId = body.user.id;

    if (!(await Review.ensureReviewPermission(slackId))) {

        await Slack.chat.postEphemeral({
            channel: body.channel?.id!,
            user: slackId,
            text: 'You do not have permission to start a review.',
            thread_ts: (body as any).message.ts!
        });
        return;
    }

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
        channel: Environment.SCRAPBOOK_CHANNEL,
        ts: (body as any).message.ts!,
        blocks: ReviewView.rejectedLock(sessionId, body.user.id)
    });

    if (session.fields['Scrapbook'].length === 0) {
        console.error(`Scrapbook not found for session: ${sessionId}`);

        respond({
            text: 'Scrapbook post not found in airtable.',
            response_type: 'ephemeral'
        });

        return;
    }

    await Review.finishReview(session.fields['Scrapbook'][0]);
});

Slack.action(Actions.UNDO, async ({ body, respond }) => {
    const slackId = body.user.id;

    if (!(await Review.ensureReviewPermission(slackId))) {
        await Slack.chat.postEphemeral({
            channel: body.channel?.id!,
            user: slackId,
            text: 'You do not have permission to start a review.',
            thread_ts: (body as any).message.ts!
        });
        return;
    }

    const sessionId = (body as any).actions[0].value;

    const session = await AirtableAPI.Session.find(sessionId);

    if (!session) {
        console.error(`Session not found: ${sessionId}`);
        return;
    }

    await AirtableAPI.Session.update(sessionId, {
        "Status": "Unreviewed"
    });

    await Slack.chat.update({
        channel: Environment.SCRAPBOOK_CHANNEL,
        ts: (body as any).message.ts!,
        blocks: ReviewView.session({
            createdAt: session.fields['Created At'],
            minutes: session.fields['Minutes'],
            text: session.fields['Work'],
            link: session.fields['Code URL'],
            recId: session.id
        })
    });
});

Slack.action(Actions.UNSUBMIT, async ({ body, respond }) => {
    const slackId = body.user.id;

    if (!(await Review.ensureReviewPermission(slackId))) {
        await Slack.chat.postEphemeral({
            channel: body.channel?.id!,
            user: slackId,
            text: 'You do not have permission to start a review.',
            thread_ts: (body as any).message.ts!
        });
        return;
    }

    const scrapbookId = (body as any).actions[0].value;

    // Check if the scrapbook exists
    const scrapbook = await AirtableAPI.Scrapbook.find(scrapbookId);

    if (!scrapbook) {
        console.error(`Scrapbook not found: ${scrapbookId}`);

        respond({
            text: 'Scrapbook not found.',
            response_type: 'ephemeral',
            replace_original: false
        });

        return;
    }

    await Review.unsubmit(scrapbookId);
});
