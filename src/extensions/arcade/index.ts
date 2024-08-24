import "./watchers/scrapbook.js";
import "./watchers/hackhour.js"
import "./watchers/airtable.js";
import "./watchers/protected_channels.js";
import "./watchers/airtable_poll.js";

import "./slack/index.js";
import "./slack/sessions.js";
import "./slack/scrapbook.js";
import "./slack/shop.js";
import "./slack/walkthrough.js";
import "./slack/showcase.js";

import { emitter } from "../../lib/emitter.js";

emitter.on('init', () => {
    console.log('[Arcade] 🕹️ Arcade Initialized!')
})