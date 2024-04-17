import { View } from "@slack/bolt";

export const Callbacks = {
    WELCOME: 'welcome',
    SETUP: 'setup',
    FINISH: 'finish', // Instructions modal after setup
    INSTRUCTIONS: 'instructions' // Instructions modal, separate from setup
}

export class Views {
    public static welcome(): View {
        return {
            "callback_id": Callbacks.WELCOME,
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
    }

    public static setup(): View {
        return {
            "callback_id": Callbacks.SETUP,
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
        }
    }
 
    public static finish(): View {
        return {
            "callback_id": Callbacks.FINISH,
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
    }

    public static instructions(): View {
        return {
            "callback_id": Callbacks.INSTRUCTIONS,
            "title": {
                "type": "plain_text",
                "text": "Instructions",
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
                "text": "Close",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Here's how to use hack hour:\n\n•  `/hack` - Start a hack hour session. You can directly start a 60 minute session using the command, similar to the following `/hack Work 60min`.\n•  `/cancel` - cancel an already running session\n•  `/goals`\n•  `/mystats`\n•  `/reminders`\n•  `/picnics` - join currently running ~picnic parties~ events\n \nInsert a synopsis and run down of hack hour terminology & usage"
                    }
                }
            ]
        };
    }    
}