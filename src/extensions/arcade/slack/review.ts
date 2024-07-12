import { KnownBlock } from "@slack/bolt";
import { AirtableAPI, AirtableScrapbookRead, scrapbookMultifilter } from "../../../lib/airtable.js";
import { Slack, app } from "../../../lib/bolt.js";
import { Actions, Environment } from "../../../lib/constants.js";
import { pfps, t } from "../../../lib/templates.js";
import { ReviewView } from "./views/review.js";
import { prisma } from "../../../lib/prisma.js";
import { reactOnContent } from "../../slack/lib/emoji.js";
import getUrls from "get-urls";
import { Evidence } from "../lib/evidence.js";

let slackReviewerCache: string[] | undefined = [];
let reviewerCacheUpdatedTs = new Date();

async function getReviewerCache() {
    const noCache = !slackReviewerCache || slackReviewerCache.length == 0;
    const expired = new Date().getTime() - reviewerCacheUpdatedTs.getTime() > 1000 * 60 * 5; // 5 minutes
    if (noCache || expired) {
        slackReviewerCache = await Slack.conversations.members({ channelID: Environment.REVIEW_CHANNEL });
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
        } catch (e) {
            console.error(e)
        }

    }

    public static async init(recordId: string, reviewerSlackId: string | null = null) {
        // New session to review! post in #arcade-reivew!
        // optionally if reviewerSlackId is provided, assign that reviewer instantly
        try {

            const review = await Slack.chat.postMessage({
                channel: Environment.REVIEW_CHANNEL,
                text: t('loading'),
            });

            const scrapbook = await AirtableAPI.Scrapbook.update(recordId, { "Review TS": review?.ts });

            if (reviewerSlackId) {
                this.assignReviewer({ scrapbookID: recordId, reviewerSlackId });
            }

            const permalink = await Slack.chat.getPermalink({
                channel: Environment.SCRAPBOOK_CHANNEL,
                message_ts: scrapbook.fields['Scrapbook TS']
            });

            console.log(permalink?.permalink);

            await Slack.chat.update({
                channel: Environment.REVIEW_CHANNEL,
                ts: review!.ts!,
                blocks: ReviewView.reviewStart({
                    slackId: scrapbook.fields['User: Slack ID'][0],
                    permalink: permalink?.permalink!,
                    recId: recordId,
                    text: scrapbook.fields['Text']
                })
            });

            reactOnContent({
                content: scrapbook.fields['Text'],
                channel: Environment.REVIEW_CHANNEL,
                ts: review!.ts!,
            })
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
            const reviewers = await AirtableAPI.Reviewer.filter(`{Slack ID} = "${reviewerSlackId}"`)
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

    public static async finishReview(scrapbookID: string, reviewerSlackID: string) {
        try {
            const scrapbook = await AirtableAPI.Scrapbook.find(scrapbookID);

            if (!scrapbook) {
                console.error(`Scrapbook not found: ${scrapbookID}`);

                return;
            }

            if (scrapbook.fields['Count Unreviewed Sessions'] === 0 && scrapbook.fields['Review TS']) {
                await AirtableAPI.Scrapbook.update(scrapbook.id, {
                    "Approved": true,
                    "Review End Time": new Date().toISOString(),
                });

                await Slack.chat.postMessage({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    text: t('review.completion.reviewed'),
                    thread_ts: scrapbook.fields['Scrapbook TS']
                });

                await Slack.chat.postEphemeral({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    blocks: ReviewView.gimme(),
                    thread_ts: scrapbook.fields['Scrapbook TS'],
                    user: reviewerSlackID
                });

                try {
                    await app.client.chat.delete({
                        channel: Environment.REVIEW_CHANNEL,
                        ts: scrapbook.fields['Review TS']
                    });
                } catch (e) {
                    console.error(e);
                }

                let rejection = false;

                for (const sessionId of scrapbook.fields['Sessions']) {
                    const session = await AirtableAPI.Session.find(sessionId);

                    if (!session) {
                        console.error(`Session not found: ${sessionId}`);
                        continue;
                    }

                    console.log(session.fields['Status']);

                    if (session.fields['Status'] === 'Rejected' || session.fields['Status'] === 'Rejected Locked') {
                        rejection = true;
                    }
                }

                if (rejection) {
                    await Slack.chat.postMessage({
                        channel: Environment.SCRAPBOOK_CHANNEL,
                        text: t('review.completion.rejected'),
                        thread_ts: scrapbook.fields['Scrapbook TS']
                    });
                }
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

            console.log(
                scrapbook.fields['Review TS'],
                Environment.REVIEW_CHANNEL
            )
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

                const dbSession = await prisma.session.findUnique({
                    where: {
                        id: sessionId
                    }
                });

                if (dbSession) {
                    dbSession.metadata.banked = false;

                    await prisma.session.update({
                        where: {
                            id: session.fields['Session ID']
                        },
                        data: {
                            scrapbook: {
                                disconnect: true,
                            },
                            scrapbookId: undefined,
                            metadata: dbSession.metadata
                        }
                    });
                }
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

    if (scrapbook.fields['Reviewed On'] !== 'Other') {
        console.error(`Scrapbook already reviewed: ${scrapbook.id}`);

        respond({
            text: 'Scrapbook already reviewed.',
            response_type: 'ephemeral',
            replace_original: true
        });

        return;
    }

    await Review.assignReviewer({ scrapbookID: scrapbook.id, reviewerSlackId: body.user.id });

    await AirtableAPI.Scrapbook.update(scrapbook.id, {
        "Reviewed On": "Hakkuun"
    });

    const user = await AirtableAPI.User.find(scrapbook.fields['User'][0]);

    await Slack.chat.postMessage({
        channel: Environment.SCRAPBOOK_CHANNEL,
        text: `<@${body.user.id}> has started the review.`,
        thread_ts: scrapbook.fields['Scrapbook TS'],
        blocks: ReviewView.scrapbookOverview({
            slackId: body.user.id,
            scrapbookId: scrapbook.id,
        })
    });

    await Slack.chat.postEphemeral({
        user: body.user.id,
        channel: Environment.SCRAPBOOK_CHANNEL,
        text: `User overview`,
        thread_ts: scrapbook.fields['Scrapbook TS'],
        blocks: ReviewView.userOverview({
            scrapbookId: scrapbook.id,
            hours: (user?.fields['Minutes (All)'] ?? -1),
            sessions: scrapbook.fields['Sessions'].length,
            reviewed: (user?.fields['Minutes (Approved)'] ?? -1),
            flagged: user?.fields['Fraud'] ?? 'error'
        })
    })

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

    const sessionIds = await AirtableAPI.Session.fromScrapbook(scrapbook.id);

    for (const sessionId of sessionIds) {
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
                blocks: ReviewView.approved(sessionId, session.fields['Approved Minutes'], session.fields['Created At'])
            });
        } else if (session.fields['Status'] === 'Rejected') {
            button = await Slack.chat.postMessage({
                channel: Environment.SCRAPBOOK_CHANNEL,
                thread_ts: scrapbook.fields['Scrapbook TS'],
                blocks: ReviewView.rejected(sessionId, session.fields['Minutes'], session.fields['Created At'])
            });
        } else if (session.fields['Status'] === 'Rejected Locked') {
            button = await Slack.chat.postMessage({
                channel: Environment.SCRAPBOOK_CHANNEL,
                thread_ts: scrapbook.fields['Scrapbook TS'],
                blocks: ReviewView.rejectedLock(sessionId, session.fields['Minutes'], session.fields['Created At'])
            });
        } else {
            const evidence = await Evidence.fetch(session.fields['Message TS'], session.fields['User: Slack ID'][0]);

            button = await Slack.chat.postMessage({
                channel: Environment.SCRAPBOOK_CHANNEL,
                text: `Review session`,
                blocks: ReviewView.session({
                    createdAt: session.fields['Created At'],
                    minutes: session.fields['Minutes'],
                    link: session.fields['Code URL'],
                    recId: session.id,

                    text: session.fields['Work'],
                    evidence: (await Evidence.grabMessageText(evidence)).join('\n'),
                    urls: await Evidence.grabLinks(evidence),
                    images: await Evidence.grabImageURLs(evidence)
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
        blocks: ReviewView.approved(sessionId, session.fields['Percentage Approved'] * session.fields['Minutes'], session.fields['Created At'], body.user.id)
    });

    // await Slack.chat.postMessage({
    //     channel: Environment.MAIN_CHANNEL,
    //     thread_ts: session.fields['Message TS'],
    //     text: t('airtable.approved', {
    //         slackId: session.fields['User: Slack ID'][0],
    //         minutes: session.fields['Approved Minutes']
    //     })
    // });

    if (session.fields['Scrapbook'].length === 0) {
        console.error(`Scrapbook not found for session: ${sessionId}`);

        respond({
            text: 'Scrapbook post not found in airtable.',
            response_type: 'ephemeral'
        });

        return;
    }

    await Review.finishReview(session.fields['Scrapbook'][0], slackId);
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
        blocks: ReviewView.rejected(sessionId, session.fields['Minutes'], session.fields['Created At'], body.user.id)
    });

    // await Slack.chat.postMessage({
    //     channel: Environment.MAIN_CHANNEL,
    //     thread_ts: session.fields['Message TS'],
    //     text: t('airtable.rejected', {
    //         slackId: session.fields['User: Slack ID'][0],
    //     })
    // });

    if (session.fields['Scrapbook'].length === 0) {
        console.error(`Scrapbook not found for session: ${sessionId}`);

        respond({
            text: 'Scrapbook post not found in airtable.',
            response_type: 'ephemeral'
        });

        return;
    }

    await Review.finishReview(session.fields['Scrapbook'][0], slackId);
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
        blocks: ReviewView.rejectedLock(sessionId, session.fields['Minutes'], session.fields['Created At'], body.user.id)
    });

    // await Slack.chat.postMessage({
    //     channel: Environment.MAIN_CHANNEL,
    //     thread_ts: session.fields['Message TS'],
    //     text: t('airtable.rejectedlocked', {
    //         slackId: session.fields['User: Slack ID'][0],
    //     })
    // });

    if (session.fields['Scrapbook'].length === 0) {
        console.error(`Scrapbook not found for session: ${sessionId}`);

        respond({
            text: 'Scrapbook post not found in airtable.',
            response_type: 'ephemeral'
        });

        return;
    }

    await Review.finishReview(session.fields['Scrapbook'][0], slackId);
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

    const evidence = await Evidence.fetch(session.fields['Message TS'], session.fields['User: Slack ID'][0]);

    await Slack.chat.update({
        channel: Environment.SCRAPBOOK_CHANNEL,
        ts: (body as any).message.ts!,
        blocks: ReviewView.session({
            createdAt: session.fields['Created At'],
            minutes: session.fields['Minutes'],
            link: session.fields['Code URL'],
            recId: session.id,

            text: session.fields['Work'],
            urls: await Evidence.grabLinks(evidence),
            evidence: (await Evidence.grabMessageText(evidence)).join('\n'),
            images: await Evidence.grabImageURLs(evidence)
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

Slack.action(Actions.MAGIC, async ({ body, respond }) => {
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

    await AirtableAPI.Scrapbook.update(scrapbookId, {
        "Magic Happening": true
    });

    await Slack.chat.postEphemeral({
        user: slackId,
        channel: Environment.SCRAPBOOK_CHANNEL,
        text: `Magic happening!`,
        thread_ts: scrapbook.fields['Scrapbook TS']
    });
});

Slack.action(Actions.NEXT_REVIEW, async ({ body, respond }) => {
    try {
        const slackId = body.user.id;
        const messageTs =  (body as any).container.thread_ts;

        if (!(await Review.ensureReviewPermission(slackId))) {
            await respond({
                text: 'You do not have permission to start a review.',
                response_type: 'ephemeral',
                replace_original: false,
                thread_ts: messageTs
            });
            return;
        }

        // get a random unreviewed scrapbook
        const records = await scrapbookMultifilter([
            '{Count Unreviewed Sessions} > 0',
            'BLANK() = Reviewer',
            'BLANK() != {Review TS}',
            '{Reviewed On} = "Other"'
        ]);

        if (records.length === 0) {
            await Slack.chat.postEphemeral({
                user: slackId,
                channel: Environment.SCRAPBOOK_CHANNEL,
                text: 'No scrapbooks to review',
                thread_ts: messageTs
            });

            console.error('No scrapbooks to review');
            return;
        }

        const scrapbook = records[0];

        // start the review process, like the start review button

        if (scrapbook.fields['Reviewed On'] !== 'Other') {
            console.error(`Scrapbook already reviewed: ${scrapbook.id}`);

            respond({
                text: 'Scrapbook already reviewed.',
                response_type: 'ephemeral',
                replace_original: true
            });

            return;
        }

        await Review.assignReviewer({ scrapbookID: scrapbook.id, reviewerSlackId: body.user.id });

        await AirtableAPI.Scrapbook.update(scrapbook.id, {
            "Reviewed On": "Hakkuun"
        });

        const user = await AirtableAPI.User.find(scrapbook.fields['User'][0]);

        await Slack.chat.postMessage({
            channel: Environment.SCRAPBOOK_CHANNEL,
            text: `<@${body.user.id}> has started the review.`,
            thread_ts: scrapbook.fields['Scrapbook TS'],
            blocks: ReviewView.scrapbookOverview({
                slackId: body.user.id,
                scrapbookId: scrapbook.id,
            })
        });

        await Slack.chat.postEphemeral({
            user: body.user.id,
            channel: Environment.SCRAPBOOK_CHANNEL,
            text: `User overview`,
            thread_ts: scrapbook.fields['Scrapbook TS'],
            blocks: ReviewView.userOverview({
                scrapbookId: scrapbook.id,
                hours: (user?.fields['Minutes (All)'] ?? -1),
                sessions: scrapbook.fields['Sessions'].length,
                reviewed: (user?.fields['Minutes (Approved)'] ?? -1),
                flagged: user?.fields['Fraud'] ?? 'error'
            })
        })

        const ts = scrapbook.fields['Review TS'];

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

        const sessionIds = await AirtableAPI.Session.fromScrapbook(scrapbook.id);

        for (const sessionId of sessionIds) {
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
                    blocks: ReviewView.approved(sessionId, session.fields['Approved Minutes'], session.fields['Created At'])
                });
            } else if (session.fields['Status'] === 'Rejected') {
                button = await Slack.chat.postMessage({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    thread_ts: scrapbook.fields['Scrapbook TS'],
                    blocks: ReviewView.rejected(sessionId, session.fields['Minutes'], session.fields['Created At'])
                });
            } else if (session.fields['Status'] === 'Rejected Locked') {
                button = await Slack.chat.postMessage({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    thread_ts: scrapbook.fields['Scrapbook TS'],
                    blocks: ReviewView.rejectedLock(sessionId, session.fields['Minutes'], session.fields['Created At'])
                });
            } else {
                const evidence = await Evidence.fetch(session.fields['Message TS'], session.fields['User: Slack ID'][0]);

                button = await Slack.chat.postMessage({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    text: `Review session`,
                    blocks: ReviewView.session({
                        createdAt: session.fields['Created At'],
                        minutes: session.fields['Minutes'],
                        link: session.fields['Code URL'],
                        recId: session.id,

                        text: session.fields['Work'],
                        evidence: (await Evidence.grabMessageText(evidence)).join('\n'),
                        urls: await Evidence.grabLinks(evidence),
                        images: await Evidence.grabImageURLs(evidence)
                    }),
                    thread_ts: scrapbook.fields['Scrapbook TS']
                });
            }

            await AirtableAPI.Session.update(sessionId, {
                "Review Button TS": button?.ts
            });
        }

        await Slack.chat.postEphemeral({
            user: body.user.id,
            channel: Environment.SCRAPBOOK_CHANNEL,
            thread_ts: messageTs,
            "text": `Review started. <${scrapbook.fields['Scrapbook URL']}|View in Scrapbook>`
        })
    } catch (e) {
        console.error(e);
    }
});

Slack.action(Actions.SHIPPED, async ({ body, respond }) => {
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

    await AirtableAPI.Scrapbook.update(scrapbookId, {
        "Is Shipped?": true
    });

    await Slack.chat.postEphemeral({
        user: slackId,
        channel: Environment.SCRAPBOOK_CHANNEL,
        text: `It's a shipped project!`,
        thread_ts: scrapbook.fields['Scrapbook TS']
    });
});