import { KnownBlock } from "@slack/bolt";
import { AirtableAPI, AirtableScrapbookRead, scrapbookMultifilter } from "../../lib/airtable.js";
import { Slack, app } from "../../lib/bolt.js";
import { Actions, Environment } from "../../lib/constants.js";
import { pfps, t } from "../../lib/templates.js";
import { View } from "./view.js";
import { prisma } from "../../lib/prisma.js";
import { reactOnContent } from "../slack/lib/emoji.js";
import getUrls from "get-urls";
import { Evidence } from "../arcade/lib/evidence.js";

/*
Flow:
1. User clicks start review
2. Reviewer is assigned to the scrapbook & reviewer opens scrapbook
3. Reviewer chooses whether the scrapbook is a ship or wip
4. Reviewer reviews sessions
5. Reviewer finishes review
6. Reviewer moves on to the next review
*/

export const Review = {
    reviewers: [] as string[],
    inReview: [] as string[],
    cacheLastUpdated: new Date(),

    // Helpers

    /**
     * assigns a reviewer to a scrapbook
     */
    async assign({
        scrapbookRecordId,
        reviewerSlackId
    }: {
        scrapbookRecordId: string,
        reviewerSlackId: string
    }) {
        try {
            const reviewers = await AirtableAPI.Reviewer.filter(`{Slack ID} = "${reviewerSlackId}"`)

            const reviewer = reviewers[0] || null;

            if (!reviewer) {
                throw new Error(`No reviewer found with Slack ID ${reviewerSlackId}`);
            }

            await AirtableAPI.Scrapbook.update(scrapbookRecordId, {
                "Review Start Time": new Date().toISOString(),
                "Reviewer": [reviewer.id],
                "Reviewed On": "Hakkuun"
            });

            this.inReview.push(reviewerSlackId);

            // return {
            //     "Review Start Time": new Date().toISOString(),
            //     "Reviewer": [reviewer.id]
            // }
        }
        catch (e) {
            console.error(e);
        }
    },

    /**
     * unassigns a reviewer from a scrapbook
     */
    async unassign({
        scrapbookRecordId,
    }: {
        scrapbookRecordId: string,
    }) {
        try {
            await AirtableAPI.Scrapbook.update(scrapbookRecordId, {
                "Review Start Time": undefined,
                "Reviewer": []
            });
        } catch (e) {
            console.error(e);
        }
    },

    /**
     * marks a review as complete
     */
    async complete({
        scrapbookRecordId,
        reviewerSlackId,
    }: {
        scrapbookRecordId: string,
        reviewerSlackId: string,
    }) {
        try {
            await AirtableAPI.Scrapbook.update(scrapbookRecordId, {
                "Approved": true,
                "Review End Time": new Date().toISOString(),
            });

            this.inReview = this.inReview.filter((id) => id !== reviewerSlackId);
        } catch (e) {
            console.error(e);
        }
    },

    /**
     * resets a review & returns it to its uninitialized state
     */
    async reset({
        scrapbookRecordId
    }: {
        scrapbookRecordId: string
    }) {
        try {
            const scrapbook = await AirtableAPI.Scrapbook.find(scrapbookRecordId);

            if (!scrapbook) {
                console.error(`Scrapbook not found: ${scrapbookRecordId}`);

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
    },

    // Flow

    /**
     * creates a review ticket
     */
    async createReviewTicket({
        recordId
    }: {
        recordId: string
    }) {
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
                ts: review.ts!,
                blocks: View.ticket({
                    postBody: scrapbook.fields['Text'],
                    permalink: permalink?.permalink!,
                    recordId,
                    posterSlackId: scrapbook.fields['User: Slack ID'][0]
                })
            });

            reactOnContent({
                content: scrapbook.fields['Text'],
                channel: Environment.REVIEW_CHANNEL,
                ts: review.ts!,
            })
        } catch (error) {
            console.error(error);
        }
    },

    async populate({
        scrapbookRecordId
    }: {
        scrapbookRecordId: string
    }) {
        try {
            const scrapbook = await AirtableAPI.Scrapbook.find(scrapbookRecordId);
            const sessionIds = await AirtableAPI.Session.fromScrapbook(scrapbookRecordId);

            if (!scrapbook || sessionIds.length === 0) {
                console.error(`Scrapbook not found: ${scrapbookRecordId}`);

                return;
            }

            for (const sessionId of sessionIds) {
                const session = await AirtableAPI.Session.find(sessionId);

                try {
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
                            blocks: View.approved({
                                sessionId, 
                                minutes: session.fields['Approved Minutes'], 
                                createdAt: session.fields['Created At'],
                            })
                        });
                    } else if (session.fields['Status'] === 'Rejected') {
                        button = await Slack.chat.postMessage({
                            channel: Environment.SCRAPBOOK_CHANNEL,
                            thread_ts: scrapbook.fields['Scrapbook TS'],
                            blocks: View.rejected({
                                sessionId, 
                                minutes: session.fields['Minutes'], 
                                createdAt: session.fields['Created At']
                            })
                        });
                    } else if (session.fields['Status'] === 'Rejected Locked') {
                        button = await Slack.chat.postMessage({
                            channel: Environment.SCRAPBOOK_CHANNEL,
                            thread_ts: scrapbook.fields['Scrapbook TS'],
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
                            thread_ts: scrapbook.fields['Scrapbook TS']
                        });
                    }

                    await AirtableAPI.Session.update(sessionId, {
                        "Review Button TS": button?.ts
                    });
                } catch (error) {
                    console.error(error);
                    await Slack.chat.postMessage({
                        channel: Environment.SCRAPBOOK_CHANNEL,
                        text: `Error populating session ${sessionId}`,
                        thread_ts: scrapbook.fields['Scrapbook TS']
                    });
                }
            }
        } catch (error) {
            console.error(error);
        }
    },

    async unsubmit({
        scrapbookRecordId
    }: {
        scrapbookRecordId: string
    }) {
        try {
            const scrapbook = await AirtableAPI.Scrapbook.find(scrapbookRecordId);

            if (!scrapbook) {
                console.error(`Scrapbook not found: ${scrapbookRecordId}`);

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
    },

    async finishReview({
        scrapbookRecordId,
        reviewerSlackId
    }: {
        scrapbookRecordId: string,
        reviewerSlackId: string
    }) {
        const scrapbook = await AirtableAPI.Scrapbook.find(scrapbookRecordId);

        if (!scrapbook) {
            console.error(`Scrapbook not found: ${scrapbookRecordId}`);

            return;
        }

        if (scrapbook.fields['Count Unreviewed Sessions'] === 0 && scrapbook.fields['Review TS']) {
            await Review.complete({ scrapbookRecordId, reviewerSlackId });
        }

        await Slack.chat.postMessage({
            channel: Environment.SCRAPBOOK_CHANNEL,
            text: t('review.completion.reviewed'),
            thread_ts: scrapbook.fields['Scrapbook TS']
        });

        await Slack.chat.postEphemeral({
            channel: Environment.SCRAPBOOK_CHANNEL,
            blocks: View.gimme(),
            thread_ts: scrapbook.fields['Scrapbook TS'],
            user: reviewerSlackId
        });

        try {
            await app.client.chat.delete({
                channel: Environment.REVIEW_CHANNEL,
                ts: scrapbook.fields['Review TS']
            });
        } catch (e) {
            console.error(e);
        }

        for (const sessionId of scrapbook.fields['Sessions']) {
            const session = await AirtableAPI.Session.find(sessionId);

            if (!session) {
                console.error(`Session not found: ${sessionId}`);
                continue;
            }

            console.log(session.fields['Status']);

            if (session.fields['Status'] === 'Rejected' || session.fields['Status'] === 'Rejected Locked') {
                await Slack.chat.postMessage({
                    channel: Environment.SCRAPBOOK_CHANNEL,
                    text: t('review.completion.rejected'),
                    thread_ts: scrapbook.fields['Scrapbook TS']
                });

                break;
            }
        }
    }
}

// 1. User clicks start review
// 2. Reviewer is assigned to the scrapbook & reviewer opens scrapbook
Slack.action(Actions.START_REVIEW, async ({ body, respond }) => {
    const slackId = body.user.id;

    if (!(Review.reviewers.includes(slackId))) {
        await Slack.chat.postEphemeral({
            channel: body.channel?.id!,
            user: slackId,
            text: 'You do not have permission to start a review.',
        });
        return;
    }

    if (Review.inReview.includes(slackId)) {
        await Slack.chat.postEphemeral({
            channel: body.channel?.id!,
            user: slackId,
            text: 'You are already in a review.',
        });
        return;
    }

    // Initialize the review
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

    await Review.assign({ scrapbookRecordId: scrapbook.id, reviewerSlackId: body.user.id });

    // Tell the user that the review has started
    await Slack.chat.update({
        channel: Environment.REVIEW_CHANNEL,
        ts,
        blocks: View.claimedTicket({
            recordId: scrapbook.id,
            permalink: scrapbook.fields['Scrapbook URL'],
            reviewerSlackId: body.user.id
        })
    });

    await Slack.chat.postMessage({
        channel: Environment.SCRAPBOOK_CHANNEL,
        text: `<@${body.user.id}> has started the review.`,
        thread_ts: scrapbook.fields['Scrapbook TS'],
    });

    // Show an overview of the user's information
    const user = await AirtableAPI.User.find(scrapbook.fields['User'][0]);

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

    await Slack.chat.postMessage({
        channel: Environment.SCRAPBOOK_CHANNEL,
        text: `Review session`,
        thread_ts: scrapbook.fields['Scrapbook TS'],
        blocks: View.isShip({ scrapbookRecordId: scrapbook.id })
    });
});

// 3. Reviewer chooses whether the scrapbook is a ship or wip
Slack.action(Actions.SHIP, async ({ body, respond }) => {
    // Mark as ship
    const scrapbookRecordId = (body as any).actions[0].value;

    await AirtableAPI.Scrapbook.update(scrapbookRecordId, {
        "Is Shipped?": true
    });

    await respond({
        replace_original: true,
    });

    await Review.populate({ scrapbookRecordId });
});

Slack.action(Actions.WIP, async ({ body, respond }) => {
    // Move onto 4
    const scrapbookRecordId = (body as any).actions[0].value;

    await respond({
        replace_original: true,
    });

    await Review.populate({ scrapbookRecordId });
});

Slack.action(Actions.MAGIC, async ({ body, respond }) => {
    const slackId = body.user.id;

    if (!(Review.reviewers.includes(slackId))) {
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

// 4. Reviewer reviews sessions
Slack.action(Actions.APPROVE, async ({ body, respond }) => {
    const slackId = body.user.id;

    // if (!(await Review.ensureReviewPermission(slackId))) {
    if (!(Review.reviewers.includes(slackId))) {
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
            minutes: session.fields['Minutes'] * session.fields['Percentage Approved'],
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

    if (!(Review.reviewers.includes(slackId))) {
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

    if (!(Review.reviewers.includes(slackId))) {
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

Slack.action(Actions.NEXT_REVIEW, async ({ body, respond }) => {
    try {
        const slackId = body.user.id;
        const messageTs = (body as any).container.thread_ts;

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
                flagged: user?.fields['Fraud Formula'] ?? 'error'
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

// Misc feature
Slack.action(Actions.UNSUBMIT, async ({ body, respond }) => {
    const slackId = body.user.id;

    // if (!(await Review.ensureReviewPermission(slackId))) {
    if (!(Review.reviewers.includes(slackId))) {
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

Slack.event('reaction_added', async ({ event }) => {
    const reaction = event.reaction;
    const user = event.item_user;
    const message_ts = event.item.ts;

    // if the reaction is :ship: and the message is in the scrapbook channel, mark the scrapbook as shipped
    if (reaction !== 'ship') {
        return;
    }

    if (!['U0C7B14Q3', 'U04QD71QWS0'].includes(user)) {
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

    await AirtableAPI.Scrapbook.update(scrapbook[0].id, {
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

setTimeout(async () => {
    const noCache = Review2.reviewers.length == 0;
    const expired = new Date().getTime() - Review2.cacheLastUpdated.getTime() > 1000 * 60 * 5; // 5 minutes

    let members: string[] | null = null;

    if (noCache || expired) {
        members = await Slack.conversations.members({ channelID: Environment.REVIEW_CHANNEL });
        Review2.cacheLastUpdated = new Date();
    }

    if (!members) {
        Review2.reviewers = [];
    } else {
        Review2.reviewers = members;
    }
});