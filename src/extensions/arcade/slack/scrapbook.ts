import { AirtableAPI } from "../../../lib/airtable.js";
import { Slack } from "../../../lib/bolt.js";
import { Actions, Callbacks } from "../../../lib/constants.js";
import { emitter } from "../../../lib/emitter.js";
import { prisma } from "../../../lib/prisma.js";
import { Loading } from "../../slack/views/loading.js";
import { log } from "../lib/log.js";
import { ChooseSessions } from "./views/scrapbook.js";

Slack.action(Actions.CHOOSE_SESSIONS, async ({ ack, body }) => {
    try {
        if (body.type !== "block_actions") return;

        const view = await Slack.views.open({
            trigger_id: body.trigger_id,
            view: Loading.loading()
        });

        if (!view) {
            await Slack.chat.postEphemeral({
                user: body.user.id,
                channel: body.user.id,
                text: "oopsies! an error occurred while opening the view. please try again.",
            });
            return;
        }

        const flowTs = body.message!.ts;

        const scrapbook = await prisma.scrapbook.findUniqueOrThrow({
            where: {
                flowTs,
            }
        });

        // // Get the latest post
        // const scrapbooks = await prisma.scrapbook.findMany({
        //     where: {
        //         userId: scrapbook?.userId,
        //     },
        //     select: {
        //         createdAt: true,
        //     },
        //     orderBy: {
        //         createdAt: "desc",
        //     },
        // });

        const sessions = await prisma.session.findMany({
            take: 50,
            orderBy: {
                createdAt: "desc"
            },
            where: {
                userId: scrapbook?.userId,
                // createdAt: {
                //     // Before today & after the last post  
                //     // Assuming the latest post is the last post (scrapbook)
                //     gte: scrapbooks.length > 1 ?  scrapbooks[1].createdAt : undefined,
                //     lte: scrapbook?.createdAt,
                // },
                metadata: {
                    path: ["banked"],
                    equals: false,
                },

                scrapbook: {
                    is: null
                },
                // scrapbookId: null,

                OR: [
                    {
                        completed: true
                    },
                    {
                        cancelled: true
                    }
                ]
            },
        });

        log(`\`\`\`${JSON.stringify(sessions)}\`\`\``)

        await Slack.views.update({
            view_id: view?.view?.id,
            view: ChooseSessions.chooseSessionsModal(sessions, scrapbook?.internalId),
        }).catch((err) => console.error('[Error]', err));
    } catch (error) {
        console.error('[Error]', error);
    }
});

Slack.view(Callbacks.CHOOSE_SESSIONS, async ({ ack, body, view }) => {
    const scrapbook = await prisma.scrapbook.findUniqueOrThrow({
        where: {
            internalId: view.private_metadata,
        }
    });

    const selectedSessionIds =
        view.state.values.sessions.sessions.selected_options?.map(
            (option: any) => option.value
        );

    if (!selectedSessionIds) {
        await Slack.chat.postEphemeral({
            user: body.user.id,
            channel: body.user.id,
            text: "uh oh. no sessions were selected. please try again!",
        });
        return;
    }

    let bankedSessions = 0;

    const selectedSessions = await prisma.session.findMany({
        where: {
            id: {
                in: selectedSessionIds,
            },
        },
    });

    for (const session of selectedSessions) {
        if (!session.metadata?.airtable?.id) {
            await Slack.chat.postMessage({
                channel: body.user.id,
                text: `haii frend! while i was taking your sessions, i accidentally dropped one while trying to scrap it!

but wait! don't fear - ask in <#C077TSWKER0> for help. also make sure ya share the following information (copy & paste it!):
\`\`\`
Scrapbook Information:
- Scrapbook TS: ${scrapbook.ts}
- Scrapbook URL: https://hackclub.slack.com/archives/C01504DCLVD/p${scrapbook.ts.replace(".", "")}

Session Information:
- Session ID: ${session.id}
- Session Timestamp: ${session.messageTs}
- Session URL: https://hackclub.slack.com/archives/C06SBHMQU8G/p${session.messageTs.replace(".", "")}

Error Details:
- No Airtable ID was saved to the session metadata. This is likely a bug.
\`\`\``,
            });

            continue;
        }

        const airtableScrapbook = await AirtableAPI.Session.update(session.metadata?.airtable?.id!, {
            "Scrapbook": [scrapbook.data.record],
        });

        if (!airtableScrapbook) {
            const permalink = await Slack.chat.getPermalink({
                channel: scrapbook.flowChannel,
                message_ts: scrapbook.flowTs,
            });

            await Slack.chat.postMessage({
                user: body.user.id,
                channel: body.user.id,
                text: `haii frend! while i was taking your sessions, i accidentally dropped one while trying to scrap it!

but wait! don't fear - ask in <#C077TSWKER0> for help. also make sure ya share the following information (copy & paste it!):
\`\`\`
Scrapbook Information:
- Scrapbook TS: ${scrapbook.ts}
- Scrapbook URL: https://hackclub.slack.com/archives/C01504DCLVD/p${scrapbook.ts.replace(".", "")}

Session Information:
- Session ID: ${session.id}
- Session Timestamp: ${session.messageTs}
- Session URL: https://hackclub.slack.com/archives/C06SBHMQU8G/p${session.messageTs.replace(".", "")}

Error Details:
- Airtable returned an error when trying to update the session record. The session will need to be linked manually, or you can optionally make a new scrapbook post.
\`\`\``,
            });

            continue;
        }

        session.metadata.banked = true;

        await prisma.session.update({
            where: {
                id: session.id,
            },
            data: {
                metadata: session.metadata,
            },
        });

        bankedSessions++;
    }

    await Slack.chat.update({
        channel: scrapbook.flowChannel,
        ts: scrapbook.flowTs,
        text: "woohoo! i've linked your sessions!",
        blocks: ChooseSessions.completedSessions(selectedSessions),
    });

    await Slack.chat.postMessage({
        channel: scrapbook.flowChannel,
        text: `haii frend! thanks for your scraps! i've linked them to your scrapbook post! I linked ${bankedSessions} session${bankedSessions === 1 ? "" : "s"} to your post - you'll have to wait for a reviewer to review your post!`,
    });
});
