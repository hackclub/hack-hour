import { AirtableAPI, AirtableScrapbookRead, scrapbookMultifilter } from "../../lib/airtable.js";
import { Slack, app } from "../../lib/bolt.js";
import { Actions, Environment } from "../../lib/constants.js";
import { t } from "../../lib/templates.js";
import { View } from "./view.js";
import { prisma } from "../../lib/prisma.js";
import { reactOnContent } from "../slack/lib/emoji.js";
import { Evidence } from "../arcade/lib/evidence.js";
import { ScrapbookCache } from "./batch.js";

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

const reviewersInReview: string[] = [];

export class Review {
    public static async isReviewer(reviewerSlackId: string) {
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

    public static async createTicket(recordId: string) {
        // New session to review! post in #arcade-reivew!
        // optionally if reviewerSlackId is provided, assign that reviewer instantly
        try {
            const review = await Slack.chat.postMessage({
                channel: Environment.REVIEW_CHANNEL,
                text: t('loading'),
            });

            const scrapbook = await AirtableAPI.Scrapbook.update(recordId, { "Review TS": review?.ts });

            const permalink = await Slack.chat.getPermalink({
                channel: Environment.SCRAPBOOK_CHANNEL,
                message_ts: scrapbook.fields['Scrapbook TS']
            });

            console.log(permalink?.permalink);

            await Slack.chat.update({
                channel: Environment.REVIEW_CHANNEL,
                ts: review!.ts!,
                blocks: View.newTicket({
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
            await ScrapbookCache.update(scrapbookID, {
                "Review Start Time": new Date().toISOString(),
                "Reviewer": [reviewer.id],
                "Reviewed On": "Hakkuun"
            });

            reviewersInReview.push(reviewerSlackId);
        }
        catch (e) {
            console.error(e);
        }
    }

    public static async populate({
        scrapbook,
        scrapbookRecId
    }: {
        scrapbook: AirtableScrapbookRead,
        scrapbookRecId: string
    }) {
        const sessionIds = await AirtableAPI.Session.fromScrapbook(scrapbookRecId);

        for (const sessionId of sessionIds) {
            const session = await AirtableAPI.Session.find(sessionId);

            if (!session) {
                console.error(`Session not found: ${sessionId}`);

                await Slack.chat.postMessage({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    text: `Session not found: ${sessionId}`,
                    thread_ts: scrapbook['Scrapbook TS']
                });

                continue;
            }

            let button;
            if (session.fields['Status'] === 'Approved') {
                button = await Slack.chat.postMessage({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    thread_ts: scrapbook['Scrapbook TS'],
                    blocks: View.approved({
                        sessionId,
                        minutes: session.fields['Approved Minutes'],
                        createdAt: session.fields['Created At']
                    })
                });
            } else if (session.fields['Status'] === 'Rejected') {
                button = await Slack.chat.postMessage({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    thread_ts: scrapbook['Scrapbook TS'],
                    blocks: View.rejected({
                        sessionId,
                        minutes: session.fields['Minutes'],
                        createdAt: session.fields['Created At']
                    })
                });
            } else if (session.fields['Status'] === 'Rejected Locked') {
                button = await Slack.chat.postMessage({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    thread_ts: scrapbook['Scrapbook TS'],
                    blocks: View.rejectedLock({
                        sessionId,
                        minutes: session.fields['Minutes'],
                        createdAt: session.fields['Created At']
                    })
                });
            } else {
                const evidence = await Evidence.fetch(session.fields['Message TS'], session.fields['User: Slack ID'][0]);

                button = await Slack.chat.postMessage({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    text: `Review session`,
                    blocks: View.session({
                        createdAt: session.fields['Created At'],
                        minutes: session.fields['Minutes'],
                        link: session.fields['Code URL'],
                        recId: session.id,

                        text: session.fields['Work'],
                        evidence: (await Evidence.grabMessageText(evidence)).join('\n'),
                        urls: await Evidence.grabLinks(evidence),
                        images: await Evidence.grabImageURLs(evidence)
                    }),
                    thread_ts: scrapbook['Scrapbook TS']
                });
            }

            await AirtableAPI.Session.update(sessionId, {
                "Review Button TS": button?.ts
            });
        }
    }

    public static async finishReview(scrapbookID: string, reviewerSlackID: string) {
        try {
            const scrapbook = await ScrapbookCache.refresh(scrapbookID);

            if (!scrapbook) {
                console.error(`Scrapbook not found: ${scrapbookID}`);

                return;
            }

            if (scrapbook.fields['Count Unreviewed Sessions'] === 0 && scrapbook.fields['Review TS']) {
                await ScrapbookCache.update(scrapbook.id, {
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
                    blocks: View.gimme(),
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

                ScrapbookCache.forcePush(scrapbook.id);

                for (const sessionId of scrapbook.fields['Sessions']) {
                    const session = await AirtableAPI.Session.find(sessionId);

                    if (!session) {
                        console.error(`Session not found: ${sessionId}`);
                        continue;
                    }

                    if (session.fields['Status'] === 'Rejected' || session.fields['Status'] === 'Rejected Locked') {
                        await Slack.chat.postMessage({
                            channel: Environment.SCRAPBOOK_CHANNEL,
                            text: t('review.completion.rejected'),
                            thread_ts: scrapbook.fields['Scrapbook TS']
                        });
                    }
                }

                reviewersInReview.splice(reviewersInReview.indexOf(reviewerSlackID), 1);
            }
        } catch (e) {
            console.error(e);
        }
    }

    public static async garbageCollection(scrapbookID: string) {
        try {
            const scrapbook = await ScrapbookCache.find(scrapbookID);

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

            await ScrapbookCache.update(scrapbook.id, {
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
            const scrapbook = await ScrapbookCache.find(scrapbookID);

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
                        id: session.fields['Session ID']
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

// 1. Start a review
Slack.action(Actions.START_REVIEW, async ({ body, respond }) => {
    const slackId = body.user.id;

    if (!(await Review.isReviewer(slackId))) {
        await Slack.chat.postEphemeral({
            channel: body.channel?.id!,
            user: slackId,
            text: 'You do not have permission to start a review.',
        });
        return;
    }

    if (reviewersInReview.includes(slackId)) {
        await Slack.chat.postEphemeral({
            channel: body.channel?.id!,
            user: slackId,
            text: 'You are already reviewing a scrapbook.',
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

    const user = await AirtableAPI.User.find(scrapbook.fields['User'][0]);

    await Slack.chat.postMessage({
        channel: Environment.SCRAPBOOK_CHANNEL,
        text: `<@${body.user.id}> has started the review.`,
        thread_ts: scrapbook.fields['Scrapbook TS'],
        blocks: View.scrapbookOverview({
            slackId: body.user.id,
            scrapbookId: scrapbook.id,
        })
    });

    await Slack.chat.postEphemeral({
        user: body.user.id,
        channel: Environment.SCRAPBOOK_CHANNEL,
        text: `User overview`,
        thread_ts: scrapbook.fields['Scrapbook TS'],
        blocks: View.userOverview({
            scrapbookId: scrapbook.id,
            hours: (user?.fields['Minutes (All)'] ?? -1),
            sessions: scrapbook.fields['Sessions'].length,
            reviewed: (user?.fields['Minutes (Approved)'] ?? -1),
            flagged: user?.fields['Fraud Formula'] ?? 'error'
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

    // await Review.populate({ 
    //     scrapbook: scrapbook.fields,
    //     scrapbookRecId: scrapbook.id 
    // });

    await Slack.chat.postMessage({
        channel: Environment.SCRAPBOOK_CHANNEL,
        blocks: View.isShip({
            recId: scrapbook.id
        }),
        thread_ts: scrapbook.fields['Scrapbook TS'],
    });
});

// 2. Determine if the scrapbook post is a WIP or a SHIP
Slack.action(Actions.SHIP, async ({ body, respond }) => {
    try {
        const recId = (body as any).actions[0].value;
        const messageTs = (body as any).message.ts;
        const slackId = body.user.id;

        if (!(await Review.isReviewer(slackId))) {

            await Slack.chat.postEphemeral({
                channel: body.channel?.id!,
                user: slackId,
                text: 'You do not have permission to start a review.',
                thread_ts: (body as any).message.ts!
            });
            return;
        }

        const scrapbook = await AirtableAPI.Scrapbook.find(recId);

        if (!scrapbook) {
            console.error(`Scrapbook not found: ${recId}`);
            return;
        }

        if (scrapbook.fields['Update type']) {
            if (scrapbook.fields['Update type'] === 'WIP') {
                await Slack.reactions.remove({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    name: 'hammer_and_wrench',
                    timestamp: messageTs
                });

                await ScrapbookCache.update(recId, {
                    "Is Shipped?": false,
                    "Update type": 'Ship'
                });

                await Slack.reactions.add({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    name: 'ship',
                    timestamp: messageTs
                });
            }
            return;
        }

        await ScrapbookCache.update(recId, {
            "Is Shipped?": true,
            "Update type": "Ship"
        });

        await Slack.reactions.add({
            channel: Environment.SCRAPBOOK_CHANNEL,
            name: 'ship',
            timestamp: messageTs
        });

        await Review.populate({
            scrapbook: scrapbook.fields,
            scrapbookRecId: recId
        });
    } catch (e) {
        console.error(e);
    }
});

Slack.action(Actions.WIP, async ({ body, respond }) => {
    try {
        const slackId = body.user.id;
        const recId = (body as any).actions[0].value;
        const messageTs = (body as any).message.ts;

        if (!(await Review.isReviewer(slackId))) {
            await Slack.chat.postEphemeral({
                channel: body.channel?.id!,
                user: slackId,
                text: 'You do not have permission to start a review.',
                thread_ts: (body as any).message.ts!
            });
            return;
        }

        const scrapbook = await AirtableAPI.Scrapbook.find(recId);

        if (!scrapbook) {
            console.error(`Scrapbook not found: ${recId}`);
            return;
        }

        if (scrapbook.fields['Update type']) {
            if (scrapbook.fields['Update type'] === 'Ship') {
                await Slack.reactions.remove({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    name: 'ship',
                    timestamp: messageTs
                });

                await ScrapbookCache.update(recId, {
                    "Is Shipped?": false,
                    "Update type": 'WIP'
                });

                await Slack.reactions.add({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    name: 'hammer_and_wrench',
                    timestamp: messageTs
                });
            }
            return;
        }

        await ScrapbookCache.update(recId, {
            "Is Shipped?": true,
            "Update type": "WIP"
        });

        await Slack.reactions.add({
            channel: Environment.SCRAPBOOK_CHANNEL,
            name: 'hammer_and_wrench',
            timestamp: messageTs
        });

        await Review.populate({
            scrapbook: scrapbook.fields,
            scrapbookRecId: recId
        });
    } catch (e) {
        console.error(e);
    }
});

Slack.action(Actions.MAGIC, async ({ body, respond }) => {
    const slackId = body.user.id;

    if (!(await Review.isReviewer(slackId))) {
        await Slack.chat.postEphemeral({
            channel: body.channel?.id!,
            user: slackId,
            text: 'You do not have permission to start a review.',
            thread_ts: (body as any).message.ts!
        });
        return;
    }

    const scrapbookId = (body as any).actions[0].value;

    const scrapbook = await ScrapbookCache.find(scrapbookId);

    if (!scrapbook) {
        console.error(`Scrapbook not found: ${scrapbookId}`);

        respond({
            text: 'Scrapbook not found.',
            response_type: 'ephemeral',
            replace_original: false
        });

        return;
    }

    await ScrapbookCache.update(scrapbookId, {
        "Magic Happening": true
    });

    await Slack.reactions.add({
        channel: Environment.SCRAPBOOK_CHANNEL,
        name: 'sparkles',
        timestamp: scrapbook.fields['Scrapbook TS']
    });
});

// 3. Approve or reject each session
Slack.action(Actions.APPROVE, async ({ body, respond }) => {
    const slackId = body.user.id;

    if (!(await Review.isReviewer(slackId))) {
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
        blocks: View.approved({
            sessionId,
            minutes: session.fields['Percentage Approved'] * session.fields['Minutes'],
            createdAt: session.fields['Created At'],
            slackId: body.user.id
        })
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

    if (!(await Review.isReviewer(slackId))) {
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
        blocks: View.rejected({
            sessionId,
            minutes: session.fields['Minutes'],
            createdAt: session.fields['Created At'],
            slackId: body.user.id
        })
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

    if (!(await Review.isReviewer(slackId))) {

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
        blocks: View.rejectedLock({
            sessionId,
            minutes: session.fields['Minutes'],
            createdAt: session.fields['Created At'],
            slackId: body.user.id
        })
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

    if (!(await Review.isReviewer(slackId))) {
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
        blocks: View.session({
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

// 4. Move to the next review
Slack.action(Actions.NEXT_REVIEW, async ({ body, respond }) => {
    try {
        const slackId = body.user.id;
        const messageTs = (body as any).container.thread_ts;

        if (!(await Review.isReviewer(slackId))) {
            await respond({
                text: 'You do not have permission to start a review.',
                response_type: 'ephemeral',
                replace_original: false,
                thread_ts: messageTs
            });
            return;
        }

        if (reviewersInReview.includes(slackId)) {
            await Slack.chat.postEphemeral({
                channel: body.channel?.id!,
                user: slackId,
                text: 'You are already reviewing a scrapbook.',
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

        await Slack.chat.update({
            channel: Environment.REVIEW_CHANNEL,
            ts: scrapbook.fields['Review TS'],
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

        await Slack.chat.postEphemeral({
            user: body.user.id,
            channel: Environment.SCRAPBOOK_CHANNEL,
            thread_ts: messageTs,
            "text": `Review started. <${scrapbook.fields['Scrapbook URL']}|View in Scrapbook>`
        })

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

        await ScrapbookCache.update(scrapbook.id, {
            "Reviewed On": "Hakkuun"
        });

        const user = await AirtableAPI.User.find(scrapbook.fields['User'][0]);

        await Slack.chat.postMessage({
            channel: Environment.SCRAPBOOK_CHANNEL,
            text: `<@${body.user.id}> has started the review.`,
            thread_ts: scrapbook.fields['Scrapbook TS'],
            blocks: View.scrapbookOverview({
                slackId: body.user.id,
                scrapbookId: scrapbook.id,
            })
        });

        await Slack.chat.postEphemeral({
            user: body.user.id,
            channel: Environment.SCRAPBOOK_CHANNEL,
            text: `User overview`,
            thread_ts: scrapbook.fields['Scrapbook TS'],
            blocks: View.userOverview({
                scrapbookId: scrapbook.id,
                hours: (user?.fields['Minutes (All)'] ?? -1),
                sessions: scrapbook.fields['Sessions'].length,
                reviewed: (user?.fields['Minutes (Approved)'] ?? -1),
                flagged: user?.fields['Fraud Formula'] ?? 'error'
            })
        })

        const ts = scrapbook.fields['Review TS'];

        // await Review.populate({ 
        //     scrapbook: scrapbook.fields,
        //     scrapbookRecId: scrapbook.id 
        // });

        await Slack.chat.postMessage({
            channel: Environment.SCRAPBOOK_CHANNEL,
            blocks: View.isShip({
                recId: scrapbook.id
            }),
            thread_ts: scrapbook.fields['Scrapbook TS'],
        });

    } catch (e) {
        console.error(e);
    }
});

// Misc
Slack.action(Actions.UNSUBMIT, async ({ body, respond }) => {
    const slackId = body.user.id;

    if (!(await Review.isReviewer(slackId))) {
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
    const scrapbook = await ScrapbookCache.find(scrapbookId);

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

// Slack.action(Actions.SHIPPED, async ({ body, respond }) => {
//     const slackId = body.user.id;

//     if (!(await Review.isReviewer(slackId))) {
//         await Slack.chat.postEphemeral({
//             channel: body.channel?.id!,
//             user: slackId,
//             text: 'You do not have permission to start a review.',
//             thread_ts: (body as any).message.ts!
//         });
//         return;
//     }

//     const scrapbookId = (body as any).actions[0].value;

//     const scrapbook = await ScrapbookCache.find(scrapbookId);

//     if (!scrapbook) {
//         console.error(`Scrapbook not found: ${scrapbookId}`);

//         respond({
//             text: 'Scrapbook not found.',
//             response_type: 'ephemeral',
//             replace_original: false
//         });

//         return;
//     }

//     await ScrapbookCache.update(scrapbookId, {
//         "Is Shipped?": true
//     });

//     await Slack.chat.postEphemeral({
//         user: slackId,
//         channel: Environment.SCRAPBOOK_CHANNEL,
//         text: `It's a shipped project!`,
//         thread_ts: scrapbook.fields['Scrapbook TS']
//     });
// });

Slack.event('reaction_added', async ({ event }) => {
    const reaction = event.reaction;
    const user = event.item_user;
    const message_ts = event.item.ts;

    // if the reaction is :ship: and the message is in the scrapbook channel, mark the scrapbook as shipped
    if (reaction !== 'ship') {
        return;
    }

    if (!['U0C7B14Q3', 'U04QD71QWS0', 'U01MPHKFZ7S'].includes(user)) {
        return;
    }

    const scrapbook = await AirtableAPI.Scrapbook.filter(`{Scrapbook TS} = '${message_ts}'`)
        .catch((error) => {
            console.error(error);
            return [];
        });

    if (scrapbook.length === 0) {
        return;
    }

    await ScrapbookCache.update(scrapbook[0].id, {
        "Is Shipped?": true
    })
        .catch((error) => {
            console.error(error)
        });

    await Slack.reactions.add({
        channel: Environment.SCRAPBOOK_CHANNEL,
        name: 'white_check_mark',
        timestamp: message_ts
    })
        .catch((error) => {
            console.error(error)
        });
});