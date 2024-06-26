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
            where: {
                userId: scrapbook?.userId,
                // createdAt: {
                //     // Before today & after the last post  
                //     // Assuming the latest post is the last post (scrapbook)
                //     gte: scrapbooks.length > 1 ?  scrapbooks[1].createdAt : undefined,
                //     lte: scrapbook?.createdAt,
                // },
                // metadata: {
                //     path: ["banked"],
                //     equals: false,
                // },

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
        }).catch((err) => console.log(err));
    } catch (error) {
        console.log(error);
        emitter.emit("error", error);
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
            text: "No sessions selected. Please try again.",
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
        // if (session.metadata?.airtable?.status === "Approved") {
        //     session.metadata.airtable.status = "Banked";

        //     await AirtableAPI.Session.update(session.metadata?.airtable?.id, {
        //         "Scrapbook": [scrapbook.data.record],
        //         "Status": "Banked",
        //     });
        // } else {
        const airtableScrapbook = await AirtableAPI.Session.update(session.metadata?.airtable?.id!, {
            "Scrapbook": [scrapbook.data.record],
        });
        // }

        if (!airtableScrapbook) {
            const permalink = await Slack.chat.getPermalink({
                channel: scrapbook.flowChannel,
                message_ts: scrapbook.flowTs,
            });

            await Slack.chat.postMessage({
                user: body.user.id,
                channel: body.user.id,
                text: "An error occurred while linking the session to the scrapbook post. Please try again. This is the link to the post: " + permalink?.permalink ?? "",
            });

            continue;
        }

        // session.metadata.banked = true;

        // await prisma.session.update({
        //     where: {
        //         id: session.id,
        //     },
        //     data: {
        //         metadata: session.metadata,
        //     },
        // });

        bankedSessions++;
    }

    await Slack.chat.update({
        channel: scrapbook.flowChannel,
        ts: scrapbook.flowTs,
        text: "🎉 Sessions linked!",
        blocks: ChooseSessions.completedSessions(selectedSessions),
    });

    await Slack.chat.postMessage({
        channel: scrapbook.flowChannel,
        text: `🎉 Congratulations! Your sessions have been linked to your scrapbook post, and ${bankedSessions} session${bankedSessions === 1 ? " has" : "s have"
            } been marked as banked.`,
    });
});
