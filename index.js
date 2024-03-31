const { App } = require('@slack/bolt');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,

  socketMode: true,
});

var hackHourTracker = {};

/**
 * /start
 * Start the user's hack hour
 */
app.command('/start', async ({ ack, body, client }) => {
  // Acknowledge the command request
  await ack();

  try {
    // Call chat.postMessage with the built-in client
    const result = await client.chat.postMessage({
      channel: body.channel_id,
      text: 'Hello world!',
    });
    console.log(result);
  }
  catch (error) {
    console.error(error);
  }

});
(async () => {
  await app.start();

  console.log('⚡️ Bolt app started');
})();