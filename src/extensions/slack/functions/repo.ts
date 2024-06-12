import { app, Slack } from "../../../lib/bolt.js";
import { Actions, Environment } from "../../../lib/constants.js";
import { Repo } from "../views/repo.js";

Slack.action(Actions.ATTACH_REPO, async ({ ack, body, client }) => {
	try {
        const slackId = body.user.id;

        await ack();

        const user = await prisma.user.findFirst({
            where: {
                slackUser: {
                    slackId
                }
            }
        });

        if (!user) {
            informUser(slackId, `Run \`${Commands.HACK}\`!`, Environment.MAIN_CHANNEL, (body as any).message.ts);
            return;
        }

		await app.client.views.open({
			trigger_id: body.trigger_id,
			view: await Repo.repo()
		});
    } catch (error) {
        emitter.emit("error", error);
    }
});