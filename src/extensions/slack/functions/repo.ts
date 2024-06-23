// import { app, Slack } from "../../../lib/bolt.js";
// import { Actions, Environment, Commands, Constants, Callbacks } from "../../../lib/constants.js";
// import { Repo } from "../views/repo.js";
// import { emitter } from "../../../lib/emitter.js";
// import { informUser } from "../lib/lib.js";
// import { prisma, uid } from "../../../lib/prisma.js";

// Slack.action(Actions.ATTACH_REPO, async ({ ack, body, client }) => {
// 	if (body.type !== "block_actions") {
// 		return;
// 	}

// 	try {
//         const slackId = body.user.id;

//         const user = await prisma.user.findFirst({
//             where: {
//                 slackUser: {
//                     slackId
//                 }
//             }
//         });

//         if (!user) {
//             informUser(slackId, `Run \`${Commands.HACK}\`!`, Environment.MAIN_CHANNEL, (body as any).message.ts);
//             return;
//         }

// 		await app.client.views.open({
// 			trigger_id: body.trigger_id,
// 			view: Repo.repo()
// 		});
//     } catch (error) {
//         emitter.emit("error", error);
//     }
// });

// Slack.view(Callbacks.ATTACH_REPO, async ({ ack, body, view, client }) => {

// 	const repoLink = body.view.state.values.repo_input.repo_link.value;
// });

// emitter.on("minute", async () => {
// 	return
// 	const sessions = await prisma.session.findMany({
// 		where: {
// 			completed: false,
// 			cancelled: false,
// 			paused: false,
// 		},
// 		select: {
// 			gitRepo: true,
// 			messageTs: true,
// 		}
// 	});

// 	for (const session of sessions) {
// 		if (!session.gitRepo) continue

// 		// https://github.com/hackclub/hack-hour -> hackclub/hack-hour
// 		const repoName = new URL(session.gitRepo).pathname.split("/").slice(1).join("/");
// 		const oneMinAgo = new Date(Date.now() - Constants.MIN_MS).toISOString();

// 		fetch(`https://api.github.com/repos/${repoName}/commits?since=${oneMinAgo}`).then(r => r.json()).then(commits => {
// 			for (const commit of commits) {
// 				app.client.chat.postMessage({
// 					channel: Environment.MAIN_CHANNEL,
// 					text: `New commit to <${session.gitRepo}|${repoName}>`,
// 					thread_ts: session.messageTs
// 				})
// 			}
// 		})

// 		await prisma.log.create({
// 			data: {
// 				userId: session.userId,
// 				id: uid(),
// 				data: {},
// 				sessions: {
// 					connect: {
// 						id: session.id
// 					}
// 				},
// 			},
// 		})
// 	}
// });