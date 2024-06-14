// export class Repo {
// 	public static repo() {
// 		return {
// 			"type": "modal" as const,
// 			"title": {
// 				"type": "plain_text" as const,
// 				"text": "Link a Repo",
// 				"emoji": true
// 			},
// 			"submit": {
// 				"type": "plain_text" as const,
// 				"text": "Submit",
// 				"emoji": true
// 			},
// 			"close": {
// 				"type": "plain_text" as const,
// 				"text": "Cancel",
// 				"emoji": true
// 			},
// 			"blocks": [
// 				{
// 					"type": "section",
// 					"text": {
// 						"type": "plain_text",
// 						"text": "Link to a GitHub repository that you're working on during this hack hour! Commits will be automatically posted in the thread.",
// 						"emoji": true
// 					}
// 				},
// 				{
// 					"type": "input",
// 					"element": {
// 						"type": "url_text_input",
// 						"action_id": "repo_input",
// 					},
// 					"label": {
// 						"type": "plain_text",
// 						"text": "GitHub repo link",
// 						"emoji": true
// 					}
// 				}
// 			]
// 		}
// 	}
// }