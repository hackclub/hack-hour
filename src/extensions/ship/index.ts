// import { emitter } from "../../lib/emitter.js";
// import { app, express } from "../../lib/bolt.js";
// import { prisma, uid } from "../../lib/prisma.js";

// import { Commands, Environment } from "../../lib/constants.js";
// import { Actions, Ship } from "./view.js";
// import { informUser, updateController, updateTopLevel } from "../slack/lib/lib.js";

// import { AirtableAPI } from "./airtable.js";
// import { Prisma, Session } from "@prisma/client";

// import { Constants } from "./constants.js";
// import { KnownBlock } from "@slack/bolt";

// app.message(async ({ message }) => {
//     if (
//         !(message.channel === Environment.SHIP_CHANNEL || message.channel === Environment.SCRAPBOOK_CHANNEL)
//     ) { return };
//     if (!message.subtype || message.subtype !== 'file_share') { return }; // Needs to be a file share event

//     // Make sure the user is in the database
//     const user = await prisma.user.findFirst({
//         where: {
//             slackUser: {
//                 slackId: message.user
//             }
//         },
//     });

//     if (!user) { return; } //TODO: Advertise the user to sign up

//     let metadata: any | null = user.metadata;

//     if (!metadata) {
//         metadata = {
//             ships: []
//         }
//     } else if (!metadata.ships) {
//         metadata.ships = [];
//     }

//     const shipTs = message.ts;

//     // DM the user to let them know that their ship has been received
//     const result = await app.client.chat.postMessage({
//         channel: message.user,
//         blocks: await Ship.init(shipTs)
//     });

//     metadata.ships.push({
//         shipTs,
//         message: result.ts
//     });

//     await prisma.user.update({
//         where: {
//             id: user.id
//         },
//         data: {
//             metadata
//         }
//     });
// });

// // Test ship flow
// app.command(Environment.PROD ? "/admin" : "/testadmin", async ({ command, ack }) => {
//     if (!Constants.VERIFIERS.includes(command.user_id)) {
//         ack({
//             response_type: "ephemeral",
//             text: "O.o"
//         });

//         return;
//     }

//     const args = command.text.split(" ");
//     const subCommand = args[0];
//     const subArgs = args.slice(1);

//     if (subCommand === "delete") {
//         // Delete message from link
//         await app.client.chat.delete({
//             channel: subArgs[0],
//             ts: subArgs[1]
//         });
//     } else if (subCommand === "trigger") {
//         // Trigger the ship flow

//         const slackId = subArgs[0];
//         const shipTs = subArgs[1];

//         // Make sure the user is in the database
//         const user = await prisma.user.findFirst({
//             where: {
//                 slackUser: {
//                     slackId: slackId
//                 }
//             },
//         });

//         if (!user) { return; } //TODO: Advertise the user to sign up

//         let metadata: any | null = user.metadata;

//         if (!metadata) {
//             metadata = {
//                 ships: []
//             }
//         } else if (!metadata.ships) {
//             metadata.ships = [];
//         }

//         // DM the user to let them know that their ship has been received
//         const result = await app.client.chat.postMessage({
//             channel: slackId,
//             blocks: await Ship.init(shipTs)
//         });

//         metadata.ships.push({
//             shipTs,
//             message: result.ts
//         });

//         await prisma.user.update({
//             where: {
//                 id: user.id
//             },
//             data: {
//                 metadata
//             }
//         });

//         // Let the admin know that the ship has been triggered
//         await app.client.chat.postEphemeral({
//             user: command.user_id,
//             channel: command.channel_id,
//             text: `Ship triggered for <@${slackId}> for ship https://hackclub.slack.com/archives/${Environment.SHIP_CHANNEL}/p${shipTs.replace(".", "")}!!`
//         });
//     } else {
//         enabled = !enabled;

//         await app.client.chat.postEphemeral({
//             channel: command.channel_id,
//             user: command.user_id,
//             text: `Arcade is now ${enabled ? "enabled" : "disabled"}`
//         });
//     }

//     await ack();
// });

// app.action(Actions.OPEN_SESSION_REVIEW, async ({ ack, body }) => {
//     try {
//         const { id } = body.channel as any;
//         const { user } = body;
//         const { ts } = (body as any).message;

//         const dbUser = await prisma.user.findFirstOrThrow({
//             where: {
//                 slackUser: {
//                     slackId: user.id
//                 }
//             }
//         });

//         const shipTs = (dbUser.metadata as any).ships.find((ship: any) => ship.message === ts)?.shipTs;

//         await ack();

//         const blocks = await Ship.openSessionReview(user.id, shipTs);

//         emitter.emit('debug', `Opening session review for ${user.id}\n\`\`\`${JSON.stringify(blocks, null, 4)}\`\`\``);

//         try {
//             await app.client.chat.update({
//                 channel: id,
//                 ts,
//                 blocks,
//                 metadata: {
//                     event_type: "shipTs",
//                     event_payload: {
//                         ts: shipTs
//                     }
//                 }
//             });
//         } catch (error) {
//             emitter.emit('error', error);

//             // Just reload the view
//             await app.client.chat.update({
//                 channel: id,
//                 ts,
//                 blocks: await Ship.init(shipTs),
//                 metadata: {
//                     event_type: "shipTs",
//                     event_payload: {
//                         ts: shipTs
//                     }
//                 }
//             });
//         }
//     } catch (error) {
//         emitter.emit('error', error);
//     }
// });

// app.action(Actions.UPDATE_SESSION_GOAL, async ({ ack, body }) => {
//     const { goalId, sessionTs } = JSON.parse((body as any).actions[0].selected_option.value);
//     const { id } = body.channel as any;
//     const { user } = body;
//     const { ts } = (body as any).message;

//     const dbUser = await prisma.user.findFirstOrThrow({
//         where: {
//             slackUser: {
//                 slackId: user.id
//             }
//         }
//     });

//     const shipTs = (dbUser.metadata as any).ships.find((ship: any) => ship.message === ts)?.shipTs;

//     let session = await prisma.session.findUniqueOrThrow({
//         where: {
//             messageTs: sessionTs,
//             OR: [
//                 {
//                     completed: true
//                 },
//                 {
//                     cancelled: true
//                 }
//             ]
//         },
//         include: {
//             goal: true
//         }
//     });

//     if (!session.goal) { throw new Error(`No goal found for session ${sessionTs}`); }

//     if (session.goal.completed) {
//         // Something happened to the goal, so we need to refresh the view
//         ack();
//         await app.client.chat.update({
//             channel: id,
//             ts,
//             blocks: await Ship.openSessionReview(user.id, shipTs),
//             metadata: {
//                 event_type: "shipTs",
//                 event_payload: {
//                     ts: shipTs
//                 }
//             }
//         });
//         return;
//     }

//     await prisma.goal.update({
//         where: {
//             id: session.goal.id
//         },
//         data: {
//             totalMinutes: {
//                 decrement: session.elapsed
//             }
//         }
//     });

//     // Update the session with the goal id
//     session = await prisma.session.update({
//         where: {
//             messageTs: sessionTs,
//             goal: {
//                 completed: false
//             }
//         },
//         data: {
//             goal: {
//                 connect: {
//                     id: goalId
//                 }
//             }
//         },
//         include: {
//             goal: true
//         }
//     });

//     await prisma.goal.update({
//         where: {
//             id: goalId
//         },
//         data: {
//             totalMinutes: {
//                 increment: session.elapsed
//             }
//         }
//     });

//     await app.client.chat.update({
//         channel: id,
//         ts,
//         blocks: await Ship.openSessionReview(user.id, shipTs),
//         metadata: {
//             event_type: "shipTs",
//             event_payload: {
//                 ts: shipTs
//             }
//         }
//     });

//     await updateController(session);
//     await updateTopLevel(session);

//     await ack();
// });

// app.action(Actions.OPEN_GOAL_SELECT, async ({ ack, body }) => {
//     const { id } = body.channel as any;
//     const { user } = body;
//     const { ts } = (body as any).message;

//     const dbUser = await prisma.user.findFirstOrThrow({
//         where: {
//             slackUser: {
//                 slackId: user.id
//             }
//         }
//     });

//     const shipTs = (dbUser.metadata as any).ships.find((ship: any) => ship.message === ts)?.shipTs;

//     await ack();

//     emitter.emit('debug', `Opening goal select for ${user.id}\n\`\`\`${JSON.stringify(await Ship.openGoalSelect(user.id), null, 4)}\`\`\``);

//     await app.client.chat.update({
//         channel: id,
//         ts,
//         blocks: await Ship.openGoalSelect(user.id),
//         metadata: {
//             event_type: "shipTs",
//             event_payload: {
//                 ts: shipTs
//             }
//         }
//     });
// });

// const fetchOrCreateUser = async (user: Prisma.UserGetPayload<{ include: { slackUser: true } }>) => {
//     let airtableUser = await AirtableAPI.User.fetch(user.slackUser!.slackId);

//     if (!user.slackUser) { throw new Error(`No slack user found for ${user.id}`); }

//     if (!airtableUser) {
//         const slackInfo = await app.client.users.info({
//             user: user.slackUser.slackId
//         });
//         if (!slackInfo.user?.real_name) { throw new Error(`No user found for ${user.slackUser.slackId}`); }

//         airtableUser = await AirtableAPI.User.create({
//             "Name": slackInfo.user.real_name,
//             "Internal ID": user.id,
//             "Slack ID": user.slackUser.slackId,
//             "Banked Minutes": 0,
//             "Ships": [],
//             "Sessions": []
//         });
//     }

//     return airtableUser;
// }

// app.action(Actions.CONFIRM_GOAL_SELECT, async ({ ack, body }) => {
//     const { id } = body.channel as any;
//     const { user } = body;
//     const { ts } = (body as any).message;

//     const dbUser = await prisma.user.findFirstOrThrow({
//         where: {
//             slackUser: {
//                 slackId: user.id
//             }
//         }
//     });

//     const shipTs = (dbUser.metadata as any).ships.find((ship: any) => ship.message === ts)?.shipTs;

//     const values = (body as any).state.values;

//     if (!values || Object.keys(values).length === 0) {
//         await ack();

//         await app.client.chat.postEphemeral({
//             user: body.user.id,
//             channel: body.user.id,
//             text: "You need to select a goal to submit"
//         });

//         return;
//     }

//     await ack();

//     await app.client.chat.update({
//         channel: id,
//         ts,
//         blocks: await Ship.confirm(user.id),
//         metadata: {
//             event_type: "shipTs",
//             event_payload: {
//                 ts: shipTs,
//                 goal: values.goals.select.selected_option.value
//             }
//         }
//     });
// });

// app.action(Actions.SUBMIT, async ({ ack, body }) => {
//     const { user: slack } = body;
//     const { ts } = (body as any).message;

//     const dbUser = await prisma.user.findFirstOrThrow({
//         where: {
//             slackUser: {
//                 slackId: slack.id
//             }
//         }
//     });

//     const shipTs = (dbUser.metadata as any).ships.find((ship: any) => ship.message === ts)?.shipTs;

//     const goalId = (body as any).message.metadata.event_payload.goal;

//     let shipUrl: string | undefined;
//     try {
//         shipUrl = (await app.client.chat.getPermalink({
//             channel: Environment.SHIP_CHANNEL,
//             message_ts: shipTs
//         })).permalink;
//     } catch (e) {
//         shipUrl = (await app.client.chat.getPermalink({
//             channel: Environment.SCRAPBOOK_CHANNEL,
//             message_ts: shipTs
//         })).permalink;
//     }

//     if (!shipUrl) { throw new Error(`No permalink found for ${shipTs}`); }

//     await ack();

//     const user = await prisma.user.findFirstOrThrow({
//         where: {
//             slackUser: {
//                 slackId: body.user.id
//             }
//         },
//         include: {
//             slackUser: true
//         }
//     });

//     const sessions = await prisma.session.findMany({
//         where: {
//             goalId,
//             OR: [
//                 {
//                     completed: true
//                 },
//                 {
//                     cancelled: true
//                 }
//             ]
//         }
//     });

//     const bank = await prisma.bank.create({
//         data: {
//             id: uid(),
//             user: {
//                 connect: {
//                     id: user.id
//                 }
//             },
//             minutes: 0,
//             type: "ship",
//             sessions: {
//                 connect: sessions.map(session => {
//                     return {
//                         messageTs: session.messageTs
//                     }
//                 })
//             },
//             data: {
//                 shipTs,
//                 shipUrl
//             }
//         }
//     });

//     const oldGoal = await prisma.goal.update({
//         where: {
//             id: goalId
//         },
//         data: {
//             completed: true
//         },
//         include: {
//             sessions: true
//         }
//     });

//     // Update the user's sessions
//     oldGoal.sessions.forEach(async session => {
//         updateController(session);
//         updateTopLevel(session);
//     });

//     // Create a new identical goal to replace the old one
//     await prisma.goal.create({
//         data: {
//             id: uid(),
//             name: oldGoal.name,
//             description: oldGoal.description,
//             completed: false,
//             user: {
//                 connect: {
//                     id: user.id
//                 }
//             },
//             totalMinutes: oldGoal.totalMinutes,
//             selected: oldGoal.selected,
//             createdAt: oldGoal.createdAt,
//         }
//     });

//     await prisma.goal.update({
//         where: {
//             id: oldGoal.id
//         },
//         data: {
//             selected: false
//         }
//     });

//     // Update on Airtable
//     const { id } = await fetchOrCreateUser(user);

//     let sessionIds = sessions.map(session => {
//         if (!session.metadata || !session.metadata.airtable || !session.metadata.airtable.id) {
//             emitter.emit('error', new Error(`No airtable ID found for ${session.messageTs}`));
//             emitter.emit('debug', `DEBUGAHH\n${JSON.stringify(session.metadata, null, 4)}`)
//             return "";
//         }
//         return (session.metadata as any).airtable.id;
//     });

//     sessionIds = sessionIds.filter(id => id !== "");

//     // It crashed here...
//     const { id: bid } = await AirtableAPI.Banks.create({
//         "Ship URL": shipUrl,
//         "User": [id],
//         "Goal Name": oldGoal.name,
//         "Created At": new Date().toISOString(),
//         "Status": "Unreviewed",
//         "Sessions": sessionIds,
//         "Ship ID": bank.id,
//         "Error": "false"
//     });

//     // Update the bank with the airtable ID
//     await prisma.bank.update({
//         where: {
//             id: bank.id
//         },
//         data: {
//             data: {
//                 ...(bank.data as object),
//                 record: bid
//             }
//         }
//     });

//     if (!body.channel?.id) {
//         emitter.emit('error', new Error(`No channel found for ${body.user.id}`));
//         return;
//     }

//     await app.client.chat.update({
//         channel: body.channel.id,
//         ts: (body as any).message.ts,
//         blocks: await Ship.complete(),
//     });
// });
