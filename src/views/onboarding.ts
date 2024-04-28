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
                    "type": "rich_text",
                    "elements": [
                        {
                            "type": "rich_text_section",
                            "elements": [
                                {
                                    "type": "text",
                                    "text": "Here's how to use hack hour:\n"
                                }
                            ]
                        },
                        {
                            "type": "rich_text_list",
                            "style": "bullet",
                            "indent": 0,
                            "border": 0,
                            "elements": [
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "/hack",
                                            "style": {
                                                "code": true
                                            }
                                        },
                                        {
                                            "type": "text",
                                            "text": " - Start a hack hour session."
                                        }
                                    ]
                                },
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "/hack [session]",
                                            "style": {
                                                "code": true
                                            }
                                        },
                                        {
                                            "type": "text",
                                            "text": " - Start a 60min session with a message quickly"
                                        }
                                    ]
                                },
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "/cancel",
                                            "style": {
                                                "code": true
                                            }
                                        },
                                        {
                                            "type": "text",
                                            "text": " - cancel an already running session"
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            "type": "rich_text_section",
                            "elements": [
                                {
                                    "type": "text",
                                    "text": "\nSome extras:\n"
                                }
                            ]
                        },
                        {
                            "type": "rich_text_list",
                            "style": "bullet",
                            "indent": 0,
                            "border": 0,
                            "elements": [
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "/mystats",
                                            "style": {
                                                "code": true
                                            }
                                        },
                                        {
                                            "type": "text",
                                            "text": " - view total stats"
                                        }
                                    ]
                                },
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "/reminders",
                                            "style": {
                                                "code": true
                                            }
                                        },
                                        {
                                            "type": "text",
                                            "text": " - modify reminder settings"
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            "type": "rich_text_section",
                            "elements": [
                                {
                                    "type": "text",
                                    "text": "\nExperiment!\n"
                                }
                            ]
                        },
                        {
                            "type": "rich_text_list",
                            "style": "bullet",
                            "indent": 0,
                            "border": 0,
                            "elements": [
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "Try making your sessions longer or shorter in the hack hour menu"
                                        }
                                    ]
                                },
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "Create a goal in the hack hour menu"
                                        }
                                    ]
                                },
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "Attach files to your session"
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };
    }

    public static instructions(): View {
        return {
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
                "text": "Exit",
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
                    "type": "rich_text",
                    "elements": [
                        {
                            "type": "rich_text_section",
                            "elements": [
                                {
                                    "type": "text",
                                    "text": "Here's how to use hack hour:\n"
                                }
                            ]
                        },
                        {
                            "type": "rich_text_list",
                            "style": "bullet",
                            "indent": 0,
                            "border": 0,
                            "elements": [
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "/hack",
                                            "style": {
                                                "code": true
                                            }
                                        },
                                        {
                                            "type": "text",
                                            "text": " - Start a hack hour session."
                                        }
                                    ]
                                },
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "/hack [session]",
                                            "style": {
                                                "code": true
                                            }
                                        },
                                        {
                                            "type": "text",
                                            "text": " - Start a 60min session with a message quickly"
                                        }
                                    ]
                                },
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "/cancel",
                                            "style": {
                                                "code": true
                                            }
                                        },
                                        {
                                            "type": "text",
                                            "text": " - cancel an already running session"
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            "type": "rich_text_section",
                            "elements": [
                                {
                                    "type": "text",
                                    "text": "\nSome extras:\n"
                                }
                            ]
                        },
                        {
                            "type": "rich_text_list",
                            "style": "bullet",
                            "indent": 0,
                            "border": 0,
                            "elements": [
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "/mystats",
                                            "style": {
                                                "code": true
                                            }
                                        },
                                        {
                                            "type": "text",
                                            "text": " - view total stats"
                                        }
                                    ]
                                },
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "/reminders",
                                            "style": {
                                                "code": true
                                            }
                                        },
                                        {
                                            "type": "text",
                                            "text": " - modify reminder settings"
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            "type": "rich_text_section",
                            "elements": [
                                {
                                    "type": "text",
                                    "text": "\nExperiment!\n"
                                }
                            ]
                        },
                        {
                            "type": "rich_text_list",
                            "style": "bullet",
                            "indent": 0,
                            "border": 0,
                            "elements": [
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "Try making your sessions longer or shorter in the hack hour menu"
                                        }
                                    ]
                                },
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "Create a goal in the hack hour menu"
                                        }
                                    ]
                                },
                                {
                                    "type": "rich_text_section",
                                    "elements": [
                                        {
                                            "type": "text",
                                            "text": "Attach files to your session"
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }
}