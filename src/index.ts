import bolt, { RespondArguments } from '@slack/bolt'; const { App } = bolt;
import { JSONFilePreset } from 'lowdb/node';

import { Views, HackHourView } from './views.js';
import { Commands, Constants, CURRENT_VERSION, Database, User, HackHourSession, Messages, genFunMessage, randomSelect, formatMessage } from './constants.js';
// TODO: seperate consts into multiple files: database, messages, lib, etc.

(async () => { // Wrap in an async function

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Database Initialization
const DEFAULT_DATA: Database = {
  globalFlags: {},
  users: {},
  hackHourSessions: {}
}

const db = await JSONFilePreset(Constants.FILE_PATH, DEFAULT_DATA);
await db.write(); // Update db.json

// Initalize the app
// TODO: seperate checking init and initalizing the user
async function checkInit(user: string) {
  // Retrieve the user's data
  var userData: User = db.data.users[user];

  // Check if the user is in the hack hour slack user group
  var usergroup = await app.client.usergroups.users.list({
    usergroup: Constants.HACK_HOUR_USERGROUP,
  });

  assertVal(usergroup.users);

  if (!(user in usergroup.users)) {
    // Add the user to the user group
    await app.client.usergroups.users.update({
      usergroup: Constants.HACK_HOUR_USERGROUP,
      users: user
    });
  }
    
  // Check if the user has been initialized
  if (!(user in db.data.users)) {
    var slackUserData = await app.client.users.info({ user: user });
    assertVal(slackUserData.user);
    var tz_offset = slackUserData.user.tz_offset;

    db.data.users[user] = {      
      version: CURRENT_VERSION,
      totalHours: 0,
      userFlags: {
        tz_offset: tz_offset,
        checkIn: true,
        hackedToday: false
      },
    }
    return;
  }

  // Check if the user's version is up to date
  if (userData.version != CURRENT_VERSION) {
    // TODO: Run code necessary to bring the user's data up to date
  }
}

function assertVal<T>(value: T | undefined | null): asserts value is T {
  // Throw if the value is undefined
  if (value === undefined) { throw new Error(`${value} is undefined, needs to be type ${typeof value}`) }
  else if (value === null) { throw new Error(`${value} is null, needs to be type ${typeof value}`) }
}

async function startSession(user: string, sessionObj: HackHourSession) {
  db.data.hackHourSessions[user] = sessionObj;

  await db.write();  
}

/**
 * /hour
 * Start the user's hack hour
 */
app.command(Commands.HACK, async ({ ack, body, client }) => {
  var text: string = body.text;
  var user: string = body.user_id;

  // Acknowledge the command request
  await ack();

  // Check if the user has been initialized
  await checkInit(user);

  if (user in db.data.hackHourSessions) {
    // Send an error
    await client.chat.postEphemeral({
      user: user,
      channel: Constants.HACK_HOUR_CHANNEL,
      text: 'You are already working on something!',
      username: 'the doctor'
    });
    return;
  }

  try {
    // Check if text was offered

    if (text) {
      // Immediately start the user's hack hour
      var motto = randomSelect(Messages.minutesRemaining);
      var work = ">" + text;

      var message = await client.chat.postMessage({
        channel: Constants.HACK_HOUR_CHANNEL,
        text: formatMessage(motto, {
          'U': user,
          'T': work,
          '#': "" + 60
        }),
        username: 'the doctor'
      });  

      assertVal(message.ts);

      startSession(user, {
        motto: motto,
        messageTs: message.ts,
        hourStart: new Date(),
        elapsed: 60, // minutes
        work: work
      });      

      return;
    }

    const result = await client.views.open({      
      trigger_id: body.trigger_id, // Pass a valid trigger_id within 3 seconds of receiving it
      view: HackHourView // View payload
    });
  }
  catch (error) {
    console.error(error);
  }

});

/**
 * hackhourView
 * View submission handler for the /hack command
 */
app.view(Views.HACK_HOUR, async ({ ack, body, view, client }) => {
  var user = body.user.id;
  var work = view.state.values.desc.workInput.value;

  // Split the work into lines, appending > at the start of each line
  assertVal(work);
  work = work.split('\n').map(line => `>${line}`).join('\n');

  await checkInit(user);

  // Check if the user is already working
  if (!(user in db.data.users)) {
    // Send an error
    await ack({
      response_action: 'errors',
      errors: {
        desc: 'You are already working on something!'
      }
    });
    return;
  } 
  else {
    // Acknowledge that information was recieved
    await ack();    
  }

  var motto = randomSelect(Messages.minutesRemaining);

  var message = await client.chat.postMessage({
    channel: Constants.HACK_HOUR_CHANNEL,
    text: formatMessage(motto, {
      'U': user,
      'T': work,
      '#': "" + 60
    }),
    username: 'the doctor'
  });

  assertVal(message.ts);
  assertVal(work);

  await startSession(user, {
    messageTs: message.ts,
    hourStart: new Date(),
    elapsed: 60, // minutes
    work: work,
    motto: motto
  });

});

/**
 * /abort
 * Abort the user's hack hour
 */
app.command(Commands.ABORT, async ({ ack, body, client }) => {
  var user = body.user_id;

  // Check if user has been initialized
  await checkInit(user);

  // Check if the user is working - if not error out
  if (!(user in db.data.hackHourSessions)) {
    await ack({
      response_action: 'errors',
      errors: {
        desc: 'You are not working on anything!'
      }
    } as RespondArguments);
    return;
  } 
  else {
    await ack();

    var session = db.data.hackHourSessions[user];

    client.chat.update({
      channel: Constants.HACK_HOUR_CHANNEL,
      ts: session.messageTs,
      text: `<@${user}> has aborted working on:\n${session.work}`
    });
    client.chat.postMessage({
      channel: Constants.HACK_HOUR_CHANNEL,
      thread_ts: session.messageTs,
      text: genFunMessage({
        'U': user,
      }, Messages.aborted),
      username: 'the doctor'
    });

    delete db.data.hackHourSessions[user];
    await db.write();
  }
});

/**
 * /checkin
 * Toggle the user's check-in status
 */
app.command(Commands.CHECKIN, async ({ ack, body, client }) => {
  var user = body.user_id;

  // Check if user has been initialized
  await checkInit(user);

  // Check if the check-in flag is not null
  if (db.data.users[user].userFlags.checkIn == null) {
    db.data.users[user].userFlags.checkIn = true;
  }
  else {
    db.data.users[user].userFlags.checkIn = !db.data.users[user].userFlags.checkIn;
  }

  // Check if the check-in flag is set
  if (db.data.users[user].userFlags.checkIn) {
    await client.chat.postEphemeral({
      user: user,
      channel: Constants.HACK_HOUR_CHANNEL,
      text: `You will be checked in every day at 12:00 AM! (Your time)`,
      username: 'the doctor'
    });
  }
  else {
    await client.chat.postEphemeral({
      user: user,
      channel: Constants.HACK_HOUR_CHANNEL,
      text: `You will not be checked in every day at 12:00 AM! (Your time)`,
      username: 'the doctor'
    });
  }
});

/**
 * /delete
 * Delete a message sent by the bot, when given the ts
 */
app.command('/delete', async ({ ack, body, client }) => {
  await ack();

  // Check if the user is an admin
  if (body.user_id != 'U04QD71QWS0') {
    await client.chat.postEphemeral({
      user: body.user_id,
      channel: body.channel_id,
      text: 'You do not have permission to use this command!',
      username: 'the doctor'
    });
    return;
  }
  
  // Split into array
  var text = body.text.split(' ');

  // Check if there is a ts
  if (text.length == 0) {
    await client.chat.postEphemeral({
      user: body.user_id,
      channel: body.channel_id,
      text: 'You need to provide a timestamp!',
      username: 'the doctor'
    });
    return;
  }

  // Delete the message
  await client.chat.delete({
    channel: body.channel_id,
    ts: text[0]
  });
});

(async () => {
  await app.start(8000);

  // Minute Interval
  setInterval(async () => {
      var now = new Date();        
      console.log(now + " - Checking for current sessions...")

      for (var user in db.data.hackHourSessions) {
        var session = db.data.hackHourSessions[user];
        var elapsed = session.elapsed - 1;

        console.log(`Elapsed time for ${user}: ${elapsed} minutes`);

        if (elapsed <= 0) {
          // End the user's hack hour
          var message = `<@${user}> finished working on \n${session.work}`;
          app.client.chat.update({
            channel: Constants.HACK_HOUR_CHANNEL,
            ts: session.messageTs,
            text: message
          });
          app.client.chat.postMessage({
            channel: Constants.HACK_HOUR_CHANNEL,
            thread_ts: session.messageTs,
            text: genFunMessage({
              'U': user,
              '#': "" + elapsed
            }, Messages.finished),
            username: 'the doctor'
          });

          delete db.data.hackHourSessions[user];
          db.data.users[user].totalHours += 1;
          db.data.users[user].userFlags.hackedToday = true;
        }
        else if (elapsed % 15 == 0 && elapsed > 1) {
          app.client.chat.postMessage({
            channel: Constants.HACK_HOUR_CHANNEL,
            thread_ts: session.messageTs,
            text: genFunMessage({
              'U': user,
              '#': "" + elapsed
            }, Messages.minuteUpdate),
            username: 'the doctor'
          });            
        } 
        else {
          app.client.chat.update({
            channel: Constants.HACK_HOUR_CHANNEL,
            ts: session.messageTs,
            text: formatMessage(session.motto, {
              'U': user,
              'T': session.work,
              '#': "" + elapsed
            })
          });
        }

        session.elapsed = elapsed;
        await db.write();
      }
  }, Constants.MIN_MS);

  // Hour Interval (Check-ins)
  setInterval(async () => {
    var now = new Date();
    console.log(now + " - Running check-ins...");

    for (var user in db.data.users) {
      var userData = db.data.users[user];
      var userFlags = userData.userFlags;

      // Skip if the user requested not to be checked in
      if (!userFlags.checkIn) {
        continue;
      }

      // Skip if timezone is not set
      if (!(userFlags.tz_offset)) {
        continue;
      }

      // Check if it's 12:00 AM in the user's timezone
      var tz_offset = userFlags.tz_offset;
      var nowUTC = new Date(now.getTime() + tz_offset * Constants.MIN_MS);
      var nowHour = nowUTC.getHours();
      
      if (nowHour != 0) {
        continue;
      }

      if (!userFlags.hackedToday) {
        app.client.chat.postMessage({
          channel: Constants.HACK_HOUR_CHANNEL,
          text: `<@${user}> you missed today's hack hour!`,
          username: 'the doctor'
        });
      }
    }

  }, Constants.HOUR_MS);
  
  console.log('🧚 Pixie started');
})();

})();