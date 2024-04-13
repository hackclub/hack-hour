import { View } from "@slack/types";

export const WELCOME_CALLBACK_ID = 'welcome';

export const welcome: View = {
	"callback_id": WELCOME_CALLBACK_ID,
	"title": {
		"type": "plain_text",
		"text": "Welcome",
		"emoji": true
	},
	"submit": {
		"type": "plain_text",
		"text": "Let's Do This!",
		"emoji": true
	},
	"type": "modal",
	"close": {
		"type": "plain_text",
		"text": "I changed my mind",
		"emoji": true
	},
	"blocks": [
		{
			"type": "image",
			"image_url": "https://cloud-e4np28bw2-hack-club-bot.vercel.app/0img_3415.jpg",
			"alt_text": "welcome banner"
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "Welcome to *Hack Hour*, brave hacker! It appears you seek something greater - a flexible way to keep on track of your projects, spending an hour (or more) daily doing what you love - *hacking!*"
			}
		}
	]
};