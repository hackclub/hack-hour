// Bolt
import bolt, { RespondArguments } from '@slack/bolt'; const { App } = bolt;
// Database
import { JSONFilePreset } from 'lowdb/node';

import { Database, CURRENT_VERSION, User, HackHourSession } from './db.js';

// Commands
import { Commands } from './commands/commands.js';
// Misc/Lib/Constants
import { Views, HackHourView } from './lib/views.js';
import { Constants } from './lib/constants.js';
import { MessageTemplates, genFunMessage, randomSelect, formatMessage } from './lib/messages.js';
import { MessageManager } from './message.js';

(async () => { // Wrap in an async function

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Database Initialization
const db = new Database();
await db.init();

// Message Manager
const messageManager = new MessageManager(app);

// Initalize the app
// TODO: seperate checking init and initalizing the user
async function checkInit(user: string) {
  // Check if the user is in the database
  if (!(await db.isUser(user))) {
    await initalizeUser(user);
  }

  // Retrieve the user's data
  var userData = await db.getUser(user);
  assertVal(userData);

  // Check if the user is in the hack hour slack user group
  var usergroup = await app.client.usergroups.users.list({
    usergroup: Constants.HACK_HOUR_USERGROUP,
  });

  assertVal(usergroup.users);

  if (!(user in usergroup.users)) {
    // Add the user to the user group
    usergroup.users.push(user);

    await app.client.usergroups.users.update({
      usergroup: Constants.HACK_HOUR_USERGROUP,
      users: usergroup.users.join(',')
    });
  }
    
  // Check if the user's version is up to date
  if (userData.version != CURRENT_VERSION) {
    //updateUser(user, userData);
  }
}

async function initalizeUser(user: string) {
  // Check if the user is already initailized
  if (user in (await db.listUsers())) {
    return;
  }

  var slackUserData = await app.client.users.info({ user: user });
  assertVal(slackUserData.user);
  var tz_offset = slackUserData.user.tz_offset;

  await db.createUser(user, {      
    version: CURRENT_VERSION,
    totalHours: 0,
    userFlags: {
      tz_offset: tz_offset,
      checkIn: true,
      hackedToday: false
    },
  });

  // Add the user to the hack hour user group
  var usergroup = await app.client.usergroups.users.list({
    usergroup: Constants.HACK_HOUR_USERGROUP,
  });
}

async function updateUser(user: string, data: User) {
  // TODO: Run code necessary to bring the user's data up to date
}

function assertVal<T>(value: T | undefined | null): asserts value is T {
  // Throw if the value is undefined
  if (value === undefined) { throw new Error(`${value} is undefined, needs to be type ${typeof value}`) }
  else if (value === null) { throw new Error(`${value} is null, needs to be type ${typeof value}`) }
}

/**
 * /hour
 * Start the user's hack hour
 */
app.command(Commands.HACK, async ({ ack, body, client }) => {
  var textBody: string = body.text;
  var user: string = body.user_id;

  // Acknowledge the command request
  await ack();

  // Check if the user has been initialized
  await checkInit(user);

  if (await db.isInSession(user)) {
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
    if (textBody) {
      // Immediately start the user's hack hour
      var message = await messageManager.postHackHourSession({
        userId: user,
        minutes: 60,
        body: textBody
      });

      assertVal(message.ts);

      await db.createSession(user, {
        template: message.template,
        messageTs: message.ts,
        hourStart: new Date(),
        elapsed: 60, // minutes
        work: textBody
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
  if (!db.isUser(user)) {
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

  var message = await messageManager.postHackHourSession({
    userId: user,
    minutes: 60,
    body: work
  });

  assertVal(message.ts);
  assertVal(work);

  await db.createSession(user, {
    messageTs: message.ts,
    hourStart: new Date(),
    elapsed: 60, // minutes
    work: work,
    template: message.template
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
  if (!(await db.isInSession(user))) {
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

    var session = await db.getSession(user);
    assertVal(session);

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
      }, MessageTemplates.aborted),
      username: 'the doctor'
    });



    await db.deleteSession(user);
  }
});

/**
 * /checkin
 * Toggle the user's check-in status
 */
app.command(Commands.CHECKIN, async ({ ack, body, client }) => {
  var userId = body.user_id;
  var user = await db.getUser(userId);

  // Check if user has been initialized
  await checkInit(userId);

  var checkIn = await db.getUserFlag(userId, 'checkIn');

  // Check if the check-in flag is not null
  if (checkIn == null) {
    await db.setUserFlag(userId, 'checkIn', true);
    checkIn = true;
  }
  else {
    await db.setUserFlag(userId, 'checkIn', !checkIn);
    checkIn = !checkIn;
  }

  // Check if the check-in flag is set
  if (checkIn) {
    await client.chat.postEphemeral({
      user: userId,
      channel: Constants.HACK_HOUR_CHANNEL,
      text: `You will be checked in every day at 12:00 AM! (Your time)`,
      username: 'the doctor'
    });
  }
  else {
    await client.chat.postEphemeral({
      user: userId,
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
    // Wrap in try-catch to prevent the interval from stopping
    try {
      var now = new Date();        
      console.log(now + " - Checking for current sessions...")

      var sessionsList = await db.listSessions();

      for (var userId in sessionsList) {
        var session = await db.getSession(userId);
        assertVal(session);

        var elapsed = session.elapsed - 1;

        if (elapsed <= 0) {
          // End the user's hack hour
          var message = `<@${userId}> finished working on \n${session.work}`;
          app.client.chat.update({
            channel: Constants.HACK_HOUR_CHANNEL,
            ts: session.messageTs,
            text: message
          });
          app.client.chat.postMessage({
            channel: Constants.HACK_HOUR_CHANNEL,
            thread_ts: session.messageTs,
            text: genFunMessage({
              'U': userId,
              '#': "" + elapsed
            }, MessageTemplates.finished),
            username: 'the doctor'
          });

          await db.deleteSession(userId);
          
          var totalHours = await db.getUserFlag(userId, 'totalHours');
          await db.setUserFlag(userId, 'totalHours', totalHours + 1);
          await db.setUserFlag(userId, 'hackedToday', true);
        }
        else if (elapsed % 15 == 0 && elapsed > 1) {
          app.client.chat.postMessage({
            channel: Constants.HACK_HOUR_CHANNEL,
            thread_ts: session.messageTs,
            text: genFunMessage({
              'U': userId,
              '#': "" + elapsed
            }, MessageTemplates.minuteUpdate),
            username: 'the doctor'
          });            
        } 
        else {
          app.client.chat.update({
            channel: Constants.HACK_HOUR_CHANNEL,
            ts: session.messageTs,
            text: formatMessage(session.template, {
              'U': userId,
              'T': session.work,
              '#': "" + elapsed
            })
          });
        }

        session.elapsed = elapsed;

        await db.updateSession(userId, session);
      }
    } catch (error) {
      console.error(error);
    }
  }, Constants.MIN_MS);

  // Hour Interval (Check-ins)
  setInterval(async () => {
    try {
    var now = new Date();
    console.log(now + " - Running check-ins...");

    var userList = await db.listUsers();

    for (var userId in userList) {
      var userData = db.getUser(userId);

      // Skip if the user requested not to be checked in
      var checkIn = await db.getUserFlag(userId, 'checkIn');
      if (!checkIn) {
        continue;
      }

      // Skip if timezone is not set
      var tz_offset = await db.getUserFlag(userId, 'tz_offset');
      if (!tz_offset) {
        continue;
      }

      // Check if it's 12:00 AM in the user's timezone
      var nowUTC = new Date(now.getTime() + tz_offset * Constants.MIN_MS);
      var nowHour = nowUTC.getHours();
      
      if (nowHour != 0) {
        continue;
      }

      // Check if the user has already hacked today
      var hackedToday = await db.getUserFlag(userId, 'hackedToday')
      if (!hackedToday) {
        app.client.chat.postMessage({
          channel: Constants.HACK_HOUR_CHANNEL,
          text: `<@${userId}> you missed today's hack hour!`,
          username: 'the doctor'
        });
      }
    }
    } catch (error) {
      console.error(error);
    }     
  }, Constants.HOUR_MS);
  
  console.log('🧑‍⚕️ Hack Hour Started!');
})();

})();