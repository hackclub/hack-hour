import { View } from '@slack/types';

export const START_CALLBACK_ID = 'start';

export const start: View = {
	"type": "modal",
	"title": {
		"type": "plain_text",
		"text": "Start a Session",
		"emoji": true
	},
	"submit": {
		"type": "plain_text",
		"text": "Submit",
		"emoji": true
	},
	"close": {
		"type": "plain_text",
		"text": "Cancel",
		"emoji": true
	},
	"blocks": [
		{
			"type": "input",
			"element": {
				"type": "plain_text_input",
				"multiline": true,
				"action_id": "task"
			},
			"label": {
				"type": "plain_text",
				"text": "Label",
				"emoji": true
			},
			"block_id": "task"
		},		
		{
			"type": "input",
			"element": {
				"type": "number_input",
				"is_decimal_allowed": false,
				"action_id": "minutes",
				"initial_value": "60",
				"min_value": "1",
				"placeholder": {
                    "type": "plain_text",
                    "text": "Amount of time in minutes for the hack hour session"
                }
			},
			"label": {
				"type": "plain_text",
				"text": "How long will this session be? (minutes)",
				"emoji": true
			},
            "block_id": "minutes"
		},
		{
			"type": "input",
			"block_id": "attachment",
			"label": {
				"type": "plain_text",
				"text": "Upload Files (optional)"
			},
			"element": {
				"type": "file_input",
				"action_id": "attachment",
				"max_files": 1,
				"filetypes": [
					"jpg",
					"png",
					"gif"
				]
			},
            "optional": true
		}
	]
};