import { View } from '@slack/types';

export const INSTRUCTIONS_CALLBACK_ID = 'instructions';

export const instructions: View = {
  "callback_id": INSTRUCTIONS_CALLBACK_ID,
	"title": {
		"type": "plain_text",
		"text": "Finish",
		"emoji": true
	},
	"submit": {
		"type": "plain_text",
		"text": "Epic",
		"emoji": true
	},
	"type": "modal",
	"close": {
		"type": "plain_text",
		"text": "Go Back",
		"emoji": true
	},
	"blocks": [
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "Congrats! :tada:\n*You're ready to use hack hour now!*"
			}
		},
		{
			"type": "divider"
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "Here's how to use hack hour:\n\n•  `/hack` - Start a hack hour session. You can directly start a 60 minute session using the command, similar to the following `/hack Work 60min`.\n•  `/cancel` - cancel an already running session\n•  `/goals`\n•  `/mystats`\n•  `/reminders`\n•  `/picnics` - join currently running ~picnic parties~ events\n \nInsert a synopsis and run down of hack hour terminology & usage"
			}
		}
	]
};