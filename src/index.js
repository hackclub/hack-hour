import bolt from '@slack/bolt'; const { App } = bolt;
import { JSONFilePreset } from 'lowdb/node';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Constants
const HACK_HOUR_CHANNEL = 'C06SBHMQU8G';
const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;

const DEFAULT_DATA = {
  "globalFlags": {
  },
  "users": {
    "user_id": {
      "doneForToday?": false,
      "totalHours": 0,
      "userFlags": {}
    }
  }
}

// Database
const db = await JSONFilePreset('db.json', DEFAULT_DATA)

// Update db.json
await db.write()

/*

{
  "user_id": {
    "message_ts": "XXXX.XXX",
    "hour_start": [Date Object],
    "work": "work msg"  
  }
}

*/

// Initalize the app

/**
 * /hour
 * Start the user's hack hour
 */
app.command('/hack', async ({ ack, body, client }) => {
  // Acknowledge the command request
  await ack();

  try {
    // Call views.open with the built-in client
    const result = await client.views.open({
      // Pass a valid trigger_id within 3 seconds of receiving it
      trigger_id: body.trigger_id,
      // View payload
      view: {
        type: 'modal',
        // View identifier
        callback_id: 'hackhour_view',
        title: {
          type: 'plain_text',
          text: 'Start your Hack Hour'
        },
        blocks: [
          {
            type: 'input',
            block_id: 'desc',
            label: {
              type: 'plain_text',
              text: 'What are you planning to do for your hack hour?'
            },
            element: {
              type: 'plain_text_input',
              action_id: 'desc_input',
              multiline: false
            }
          }
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit'
        }
      }
    });
  }
  catch (error) {
    console.error(error);
  }

});

/**
 * hackhour_view
 * View submission handler for the /hack command
 */
app.view('hackhour_view', async ({ ack, body, view, client }) => {
  var user = body.user.id;
  var work = view.state.values.desc.desc_input.value;

  // Check if the user is already working
  if (user in hackHourTracker) {
    // Send an error
    await ack({
      response_action: 'errors',
      errors: {
        desc: 'You are already working on something!'
      }
    });
    return;
  } else {
    // Acknowledge that information was recieved
    await ack();    
  }

  var message = await client.chat.postMessage({
    channel: HACK_HOUR_CHANNEL,
    text: `<@${user}> has \`60\` minutes to work on:\n>${work}`
  });

  hackHourTracker[user] = {
    message_ts: message.ts,
    hour_start: new Date(),
    work: work
  };
});

/**
 * /abort
 * Abort the user's hack hour
 */
app.command('/abort', async ({ ack, body, client }) => {
  var user = body.user_id;

  // Check if the user is working - if not error out
  if (!hackHourTracker.hasOwnProperty(user)) {
    await ack({
      response_action: 'errors',
      errors: {
        desc: 'You are not working on anything!'
      }
    });
    return;
  } else {
    await ack();
  }
  
  if (user in hackHourTracker) {
    var user_info = hackHourTracker[user];
    var message = `<@${user}> has aborted working on:\n>${user_info.work}`;
    client.chat.update({
      channel: HACK_HOUR_CHANNEL,
      ts: user_info.message_ts,
      text: message
    });
    client.chat.postMessage({
      channel: HACK_HOUR_CHANNEL,
      thread_ts: user_info.message_ts,
      text: `<@${user}> has aborted their hack hour!`
    });

    delete hackHourTracker[user];
  }

});

(async () => {
  await app.start();

  // Run the interval at the start of the minute
  setInterval(() => {
      var now = new Date();        
      console.log(now + " - Checking for hack hours...")

      for (var user in hackHourTracker) {
        var user_info = hackHourTracker[user];
        var elapsed = new Date(HOUR_MS - (now - user_info.hour_start));
        
        if (elapsed.getMinutes() >= 60) {
          // End the user's hack hour
          var message = `<@${user}> finished working on \n>${user_info.work}\``;
          app.client.chat.update({
            channel: HACK_HOUR_CHANNEL,
            ts: user_info.message_ts,
            text: message
          });
          app.client.chat.postMessage({
            channel: HACK_HOUR_CHANNEL,
            thread_ts: user_info.message_ts,
            text: `<@${user}> has finished their hack hour!`
          });

          delete hackHourTracker[user];
        }
        else if (elapsed.getMinutes() % 15 == 0 && elapsed.getMinutes() > 1) {
          app.client.chat.postMessage({
            channel: HACK_HOUR_CHANNEL,
            thread_ts: user_info.message_ts,
            text: `<@${user}> you have \`${elapsed.getMinutes()}\`!`
          });            
        } 
        else {
          var message = `<@${user}> has \`${elapsed.getMinutes()}\` minutes to work on:\n>${user_info.work}`;
          app.client.chat.update({
            channel: HACK_HOUR_CHANNEL,
            ts: user_info.message_ts,
            text: message
          });
        }
      }
  }, MIN_MS);

  console.log('⚡️ Bolt app started');
})();