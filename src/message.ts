// An abstraction for message management

import { App } from "@slack/bolt";
import emojiKeywords from "./lib/emojiKeywords.js";
import { HackHourSession } from "./db.js";
import { Constants } from "./lib/constants.js";

// The idea is to simply message management through an abstraction
// This way will also allow me add to add more functionality, such as reactions

const DOCTOR = {
  username: 'the doctor'
}

export const MessageTemplates = {
  // has `##` to remain
  minutesRemaining: [
    "it looks like <@<U>> is getting more power this hour! `<#>` minutes remaining to work on:\n<T>",
    "<@<U>> is keeping the doctor away with this hack hour! `<#>` minutes remaining to work on:\n<T>",
    "let's go! <@<U>> has `<#>` minutes to work on:\n<T>"    
  ],
  // <@> you have <##> minutes left
  minuteUpdate: [
    "time's ticking <@<U>>, looks like you have `<#>` minutes left!",
    "you have `<#>` minutes left <@<U>>! keep it up!",
    "almost there <@<U>>, `<#>` minutes left! take a coffee break while you're at it!",
    "power through <@<U>>! you have `<#>` minutes left!"
  ],
  // <@> has aborted their hack hour
  aborted: [
    "yikes! <@<U>> cancelled their hack hour!",
    "i'm really disappointed, but <@<U>> ended their hack hour.",
    "what was I expecting when <@<U>> aborted their hour early?",
    "<@<U>> \"finished\" early."
  ],
  // <@> has finished their hack hour
  finished: [
    "WOOOOO! YOU DID IT <@<U>>!",
    "guess what? <@<U>> finished their hour!",
    "<@<U>>'s pretty wizard! they finished their hour!",
    "epic job <@<U>>, you're done!"
  ],
  // You missed your check in!
  missedCheckIn: [
    "i'm so sad ): you didn't do an hour today",
    "looks like you didn't do an hour today ): maybe tomorrow"
  ]
}

export class MessageManager {
  app: App;

  constructor(app: App) {
    this.app = app;
  }

  private randomSelect(templates: string[]): string {
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private formatMessage(template: string, data: { [key: string]: string }): string {
    let message = template;
    for (const key in data) {
      message = message.replace(new RegExp(`<${key}>`, 'g'), data[key]);
    }
    return message;
  }

  // Post Hack Hour Session
  async postHackHourSession(messageData: { userId: string, minutes: number, body: string }) {
    const template = this.randomSelect(MessageTemplates.minutesRemaining);

    const messageBody = this.formatMessage(template, {
      'U': messageData.userId,
      '#': "" + messageData.minutes,
      'T': messageData.body
    });

    const slackMsg = await this.app.client.chat.postMessage({
      channel: Constants.HACK_HOUR_CHANNEL,
      text: messageBody,
      username: DOCTOR.username
    });

    // Process the work message & react with associated emoji
    const workWords = messageData.body.split(' ');
    workWords.forEach(async word => {
      if (emojiKeywords[word]) {
        await this.app.client.reactions.add({
          channel: Constants.HACK_HOUR_CHANNEL,
          name: emojiKeywords[word],
          timestamp: slackMsg.ts
        });
      }
    });

    return { template, ts: slackMsg.ts } ;
  }
  // Update Hack Hour Session
  async updateHackHourSession(userId: string, session: HackHourSession) {
    const messageBody = this.formatMessage(session.template, {
      'U': userId,
      '#': "" + session.elapsed,
      'T': session.work
    });

    this.app.client.chat.update({
      channel: Constants.HACK_HOUR_CHANNEL,
      ts: session.messageTs,
      text: messageBody
    });           
  }
  // Post Minute Update
  async postMinuteUpdate(messageData: { userId: string, minutes: number }) {
    const template = this.randomSelect(MessageTemplates.minuteUpdate);

    const messageBody = this.formatMessage(template, {
      'U': messageData.userId,
      '#': "" + messageData.minutes
    });

    await this.app.client.chat.postMessage({
      channel: Constants.HACK_HOUR_CHANNEL,
      text: messageBody,
      username: DOCTOR.username
    });
  }
  // Abort Hack Hour Session
  async abortHackHourSession(messageData: { userId: string }) {
    const template = this.randomSelect(MessageTemplates.aborted);

    const messageBody = this.formatMessage(template, {
      'U': messageData.userId
    });

    await this.app.client.chat.postMessage({
      channel: Constants.HACK_HOUR_CHANNEL,
      text: messageBody,
      username: DOCTOR.username
    });
  }
  // Complete Hack Hour Session
  async completeHackHourSession(messageData: { userId: string, channelId: string }) {
    const template = this.randomSelect(MessageTemplates.finished);

    const messageBody = template
      .replace(new RegExp('<U>', 'g'), messageData.userId);

    await this.app.client.chat.postMessage({
      channel: messageData.channelId,
      text: messageBody,
      username: DOCTOR.username
    });
  }
}