import { Slack } from "../../../lib/bolt.js";
import { Actions, Commands } from "../../../lib/constants.js";
import { prisma } from "../../../lib/prisma.js";
import { t } from "../../../lib/templates.js";
import { Loading } from "../../slack/views/loading.js";
import { Sessions } from "./views/sessions.js";

Slack.command(Commands.SESSIONS, async ({ command }) => {
    const view = await Slack.views.open({
        trigger_id: command.trigger_id,
        view: Loading.loading()
    });

    const slackUser = await prisma.slackUser.findUnique({
        where: {
            slackId: command.user_id,
        }
    });

    if (!slackUser) {
        await Slack.views.update({
            view_id: view?.view?.id,
            view: Loading.error(t("error.not_a_user"))
        })
        return;
    }

    const sessions = await prisma.session.findMany({
        where: {
            userId: slackUser.userId,
        },
        skip: 0,
        take: 3,
    });

    if (sessions.length === 0) {
        await Slack.views.update({
            view_id: view?.view?.id,
            view: Loading.error(t("error.first_time"))
        })
        return;
    }

    await Slack.views.update({
        view_id: view?.view?.id,
        view: await Sessions.sessions({
            userId: slackUser.userId, 
            sessions, 
            page: 0,
        })
    });
});

Slack.action(Actions.SESSIONS, async ({ body, client }) => {
    const view = await Slack.views.push({
        trigger_id: (body as any).trigger_id,
        view: Loading.loading()
    });

    const slackUser = await prisma.slackUser.findUnique({
        where: {
            slackId: body.user.id,
        }
    });

    if (!slackUser) {
        await Slack.views.update({
            view_id: view?.view?.id,
            view: Loading.error(t("error.not_a_user"))
        })
        return;
    }

    const session = await prisma.session.findFirst({
        where: {
            userId: slackUser.userId,
        }
    });

    if (!session) {
        await Slack.views.update({
            view_id: view?.view?.id,
            view: Loading.error(t("error.first_time"))
        })
        return;
    }

    await Slack.views.update({
        view_id: view?.view?.id,
        view: await Sessions.sessions({
            userId: slackUser.userId, 
            sessions: [],
            page: -1,
        })
    });
});

Slack.action(Actions.SESSIONS_PREVIOUS, async ({ body }) => {
    const view = (body as any).view;
    let { page, userId } = JSON.parse(view.private_metadata);

    if (isNaN(page)) {
        return;
    }

    if (page === -1) {
        const sessions = await prisma.session.findMany({
            where: {
                userId,
            },
            skip: 0,
            take: 3,
        });

        await Slack.views.update({
            view_id: view.id,
    
            view: await Sessions.sessions({
                userId,
                sessions,
                page: 0,
                error: t('error.cant_go_back')
            })
        });
        return;
    }

    page--;

    const sessions = await prisma.session.findMany({
        where: {
            userId,
        },
        skip: page <= 0 ? 0 : page * 3,
        take: 3,
    });

    await Slack.views.update({
        view_id: view.id,
        view: await Sessions.sessions({
            userId,
            sessions,
            page,
        })
    });
});

Slack.action(Actions.SESSIONS_NEXT, async ({ body }) => {
    const view = (body as any).view;
    let { page, userId } = JSON.parse(view.private_metadata);

    if (isNaN(page)) {
        return;
    }

    page++;

    const sessions = await prisma.session.findMany({
        where: {
            userId
        },
        skip: page <= 0 ? 0 : page * 3,
        take: 3,
    });

    if (sessions.length === 0) {
        page--;

        const sessions = await prisma.session.findMany({
            where: {
                userId,
            },
            skip:  page <= 0 ? 0 : page * 3,
            take: 3,
        });

        await Slack.views.update({
            view_id: view.id,
            view: await Sessions.sessions({
                userId,
                sessions,
                page,
                error: t('error.cant_go_next')
            })
        });
        return;
    }

    await Slack.views.update({
        view_id: view.id,
        view: await Sessions.sessions({
            userId,
            sessions,
            page,
        })
    });
});

Slack.action('sessions', async ({}) => {});