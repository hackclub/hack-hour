// Proivdes methods to allow users to reinstall the app, adding their own user token to the database.
import { express, app } from "../lib/bolt.js";
import { Environment } from "../lib/constants.js";
import { prisma, uid } from "../lib/prisma.js";

function genScopeReq() {
    return `https://slack.com/oauth/v2/authorize?client_id=${Environment.CLIENT_ID}`;  
}

express.get('/tokenget', async (req, res) => {
    const code = req.query.code;
    const slackId = req.query.user;

    if (!code && !slackId) {
        res.status(400).send('Missing data!');
        return;
    }

    // Update the user's token in the database
    await prisma.slackUser.update({
        where: {
            slackId: slackId as string
        },
        data: {
            slackToken: code as string
        }
    });

    // Return a success message
    res.status(200).send('Token updated!');
});

console.log(`ℹ️ OAuth2 endpoint running at ${genScopeReq()}`);