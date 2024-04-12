import { View } from '@slack/types';
import exp from 'constants';

export const GOALS_CALLBACK_ID = 'goals';
export const CREATE_GOAL_CALLBACK_ID = 'createGoal';
export const DELETE_GOAL_CALLBACK_ID = 'deleteGoal';

export const goals: View = {
	"type": "modal",
	"submit": {
		"type": "plain_text",
		"text": "I'm done",
		"emoji": true
	},
	"close": {
		"type": "plain_text",
		"text": "Close",
		"emoji": true
	},
	"title": {
		"type": "plain_text",
		"text": "Goals",
		"emoji": true
	},
	"blocks": [
		{
			"type": "header",
			"text": {
				"type": "plain_text",
				"text": "Select your goals:",
				"emoji": true
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "radio_buttons",
					"options": [
						{
							"text": {
								"type": "plain_text",
								"text": "*plain_text option 0*",
								"emoji": true
							},
							"value": "value-0"
						}
					],
					"action_id": "selectGoal"
				}
			]
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Create Goal",
						"emoji": true
					},
					"value": "create"
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Delete Goal",
						"emoji": true
					},
					"value": "delete"
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Set as Default Goal",
						"emoji": true
					},
					"value": "setdefault"
				}
			]
		},
		{
			"type": "divider"
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "You've spent *{hours}* hours working on _{goal}_."
			}
		}
	]
};

export const goalCreate: View = {
	"type": "modal",
	"callback_id": CREATE_GOAL_CALLBACK_ID,
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
	"title": {
		"type": "plain_text",
		"text": "Goals",
		"emoji": true
	},
	"blocks": [
		{
			"type": "input",
			"element": {
				"type": "plain_text_input",
				"action_id": "goalName"
			},
			"label": {
				"type": "plain_text",
				"text": "Enter Goal Name:",
				"emoji": true				
			},
			"block_id": "goal"
		}
	]
}

export const goalDelete: View = {
	"type": "modal",
	"callback_id": DELETE_GOAL_CALLBACK_ID,
	"submit": {
		"type": "plain_text",
		"text": "Yes",
		"emoji": true
	},
	"close": {
		"type": "plain_text",
		"text": "No",
		"emoji": true
	},
	"title": {
		"type": "plain_text",
		"text": "Goals",
		"emoji": true
	},
	"blocks": [
		{
			"type": "rich_text",
			"elements": [
				{
					"type": "rich_text_section",
					"elements": [
						{
							"type": "text",
							"text": "Are you sure you want delete this goal?"
						}
					]
				}
			]
		}
	]
};