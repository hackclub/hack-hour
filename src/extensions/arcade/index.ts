import "./watchers/scrapbook.js";
import "./watchers/hackhour.js"
import "./watchers/airtable.js";
import "./slack/index.js";
import "./slack/shop.js";
import { emitter } from "../../lib/emitter.js";

emitter.on('init', () => {
    console.log('🕹️ Arcade Initialized!')
})