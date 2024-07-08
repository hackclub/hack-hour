// keep an ear on #arcade-announcement channel & make sure only approved messages are posted

import { Slack, app } from "../../../lib/bolt.js";

const protectedChannels = [
  "C07AXU6FCC8", // arcade-bulletin
  "C07ABG7JW69", // game-over
  "C07AQ75CWQJ", // arcade-shoutouts
]

const getOwnBotID = async () => {
  const bot = await Slack.auth.test();
  return bot.user_id || '';
}

const getUsersInChannel = async (channelID: string) => {
  return await Slack.conversations.members({channelID});
}
const ensureChannelJoined = async (channelID: string) => {
  const channel = await Slack.conversations.info(channelID);
  if (!channel?.ok) {
    throw new Error(`Failed to get channel info for ${channelID}`);
  }

  const [usersInChannel, ownBotID] = await Promise.all([
    getUsersInChannel(channelID), 
    getOwnBotID()
  ]);

  if (!usersInChannel.includes(ownBotID)) {
    console.error(`⚠️ Bot is not in required channel ${channelID}`);
  }
}

// Run this once on startup to ensure the bot is correctly configured in the channel
setTimeout(() => {
  protectedChannels.forEach(channelID => {
    ensureChannelJoined(channelID)
  })
}, 1000 * 5);

app.event('message', async ({ event }) => {  
  try {
    if (!protectedChannels.includes(event.channel)) { return; }
    if (event.subtype === 'bot_message') { return; }

    let user: string | undefined = (event as any).user;
    if (!user) { return; }

    const userInfo = await Slack.users.info({user});

    if (userInfo.user?.is_admin) { return }
    if (userInfo.user?.is_owner) { return }
    if (userInfo.user?.is_primary_owner) { return }

    const thread_ts = (event as any)?.thread_ts || "";

    if (event.channel == "C07AQ75CWQJ") {
      if (thread_ts) {
        return;
      }        
    }    
    
    // not an admin, delete the message
    await Slack.chat.delete({channel: event.channel, ts: event.ts});

    await Slack.chat.postEphemeral({
      channel: event.channel,
      user,
      thread_ts,
      text: "This is a read-only channel. Only admins can post here."
    });
  } catch (error) {
    console.error(error);
  }
});