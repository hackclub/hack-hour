import { View } from '@slack/types';

export const SETUP_CALLBACK_ID = 'setup';

export const setup: View = {
  "callback_id": SETUP_CALLBACK_ID,
	"title": {
		"type": "plain_text",
		"text": "Setup",
		"emoji": true
	},
	"submit": {
		"type": "plain_text",
		"text": "Let's Get Started",
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
				"text": "*Let's set up hack hour.* These options are always modifiable, and you can change them at any time."
			}
		},
		{
			"type": "divider"
		},
		{
			"type": "input",
			"element": {
				"type": "plain_text_input",
				"action_id": "goal_text"
			},
			"label": {
				"type": "plain_text",
				"text": "Enter your first personal goal: (ex. a project you're working on or a skill you're learning)",
				"emoji": true
			},
			"block_id": "goal"
		},
		{
			"type": "input",
			"element": {
				"type": "timepicker",
				"initial_time": "15:00",
				"placeholder": {
					"type": "plain_text",
					"text": "Select time",
					"emoji": true
				},
				"action_id": "reminder_time"
			},
			"label": {
				"type": "plain_text",
				"text": "When do you want to be reminded everyday? (Hour Only)",
				"emoji": true
			},
			"block_id": "reminder"
		}
	]
};