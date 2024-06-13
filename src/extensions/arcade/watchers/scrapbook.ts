import { express } from "../../../lib/bolt.js";
import { prisma } from "../../../lib/prisma.js";
import { AirtableAPI } from "../lib/airtable.js";
import { app } from "../../../lib/bolt.js";
import { ChooseSessions } from "../view.js";

// {
//     messageText: 'another test',
//     postTime: '2024-06-12T13:33:04.000Z',
//     attachments: [
//       'https://scrapbook-into-the-redwoods.s3.amazonaws.com/b38ad624-7897-47b7-9cb8-3e9aee60247e-image.png'
//     ],
//     userName: 'Josias',
//     channel: 'C063RPGKRL2',
//     slackId: `U063RPGKRL2`
// }

express.post("/scrapbook/post", async (req, res) => {
  // 1. Send a DM to the user so they can select which sessions go to their scrapbook post
  // 2. Add an entry to the airtable to represent the scrapbook post
  // 3. Mark sessions associated with the scrapbook post (& are approved) as "banked"
  // 4. Send a confirmation message to the user

  const slackId = req.body.slackId;

  const user = await prisma.user.findFirstOrThrow({
    where: {
      slackUser: {
        slackId,
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  if (!(user.metadata as any).airtable) {
    throw new Error(`Airtable user not found for ${user.id}`);
  }

  const { id } = await AirtableAPI.Scrapbook.create({
    "Ship TS": req.body.postTime,
    User: [(user.metadata as any).airtable?.id],
    Sessions: [],
    Attachments: req.body.attachments.map((url: string) => ({ url })),
  });

  await app.client.chat.postMessage({
    channel: slackId,
    text: "Select which sessions should be linked to your scrapbook post.",
    blocks: ChooseSessions.chooseSessionsButton(user.id, id),
  });
});
