// An abstraction for message management

import { App } from "@slack/bolt";

const doctorInfo = {
  username: "the doctor"
}



type messageObject = {
  template: string,
  text: string
};

export class Messages {
  app: App;
  template: string;
  text: string;

  constructor(app: App) {
    this.app = app;
    this.template = "";
    this.text = "";
  }

  async exportMessage() {
    // Export the message so it can be saved to the database
    return {
      template: this.template,
      text: this.text
    }
  }
}