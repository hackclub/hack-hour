import bolt from '@slack/bolt'; const { App } = bolt;
import { JSONFilePreset } from 'lowdb/node';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Constants
const HACK_HOUR_CHANNEL = 'C06S6E7CXK7';//'C06SBHMQU8G';
const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;

const DEFAULT_DATA = {
  "globalFlags": {
  },
  "users": {
  /*"userId": {
      "isDoneForToday": false,
      "totalHours": 0,
      "userFlags": {},
      "isHacking": false,
      "currentHack": {
        "message_ts": "XXXX.XXX",
        "hourStart": [Date Object],
        "work": "work msg"
      }
    }*/
  }
}

// Database
const db = await JSONFilePreset('db.json', DEFAULT_DATA)

// Update db.json
await db.write()

// Initalize the app
function checkInit(user) {
  if (!db.data.users.hasOwnProperty(user)) {
    db.data.users[user] = {
      "isDoneForToday": false,
      "totalHours": 0,
      "userFlags": {},
      "isHacking": false,
      "currentHack": {}
    }
    return;
  }
}


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

  checkInit(user);

  // Check if the user is already working
  if (db.data.users[user].isHacking) {
    // Send an error
    await ack({
      response_action: 'errors',
      errors: {
        desc: 'You are already working on something!'
      }
    });
    return;
  } 
  else if (db.data.users[user].isDoneForToday) {
    // Send an error
    await ack({
      response_action: 'errors',
      errors: {
        desc: 'You are done for the day!'
      }
    });
    return;
  }
  else {
    // Acknowledge that information was recieved
    await ack();    
  }

  var message = await client.chat.postMessage({
    channel: HACK_HOUR_CHANNEL,
    text: `<@${user}> has \`60\` minutes to work on:\n>${work}`
  });

  db.data.users[user].isHacking = true;
  db.data.users[user].currentHack = {
    message_ts: message.ts,
    hourStart: new Date(),
    work: work
  };
  await db.write();
});

/**
 * /abort
 * Abort the user's hack hour
 */
app.command('/abort', async ({ ack, body, client }) => {
  var user = body.user_id;

  // Check if user has been initialized
  checkInit(user);

  // Check if the user is working - if not error out
  if (!db.data.users[user].isHacking || db.data.users[user].isDoneForToday) {
    await ack({
      response_action: 'errors',
      errors: {
        desc: 'You are not working on anything!'
      }
    });
    return;
  } 
  else {
    await ack();

    var userInfo = db.data.users[user].currentHack;

    client.chat.update({
      channel: HACK_HOUR_CHANNEL,
      ts: userInfo.message_ts,
      text: `<@${user}> has aborted working on:\n>${userInfo.work}`
    });
    client.chat.postMessage({
      channel: HACK_HOUR_CHANNEL,
      thread_ts: userInfo.message_ts,
      text: `<@${user}> has aborted their hack hour!`
    });

    db.data.users[user].currentHack = {};
    db.data.users[user].isHacking = false;
    await db.write();
  }

});

(async () => {
  await app.start();

  // Run the interval at the start of the minute
  setInterval(() => {
      var now = new Date();        
      console.log(now + " - Checking for hack hours...")

      for (var user in db.data.users) {
        var userInfo = db.data.users[user].currentHack;
        var hourStart = new Date(Date.parse(userInfo.hourStart));
        var elapsed = new Date(HOUR_MS - (now - hourStart));
        
        if (elapsed.getMinutes() >= 60) {
          // End the user's hack hour
          var message = `<@${user}> finished working on \n>${userInfo.work}\``;
          app.client.chat.update({
            channel: HACK_HOUR_CHANNEL,
            ts: userInfo.message_ts,
            text: message
          });
          app.client.chat.postMessage({
            channel: HACK_HOUR_CHANNEL,
            thread_ts: userInfo.message_ts,
            text: `<@${user}> has finished their hack hour!`
          });

          db.data.users[user].isHacking = false;
          db.data.users[user].isDoneForToday = true;
        }
        else if (elapsed.getMinutes() % 15 == 0 && elapsed.getMinutes() > 1) {
          app.client.chat.postMessage({
            channel: HACK_HOUR_CHANNEL,
            thread_ts: userInfo.message_ts,
            text: `<@${user}> you have \`${elapsed.getMinutes()}\`!`
          });            
        } 
        else {
          var message = `<@${user}> has \`${elapsed.getMinutes()}\` minutes to work on:\n>${userInfo.work}`;
          app.client.chat.update({
            channel: HACK_HOUR_CHANNEL,
            ts: userInfo.message_ts,
            text: message
          });
        }
      }
  }, MIN_MS);

  console.log('⚡️ Bolt app started');
})();