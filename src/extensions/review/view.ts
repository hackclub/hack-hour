import { KnownBlock, ModalView, RichTextQuote } from "@slack/bolt";
import { Actions, Environment } from "../../lib/constants.js";
import { formatHour, pfps, randomChoice, t } from "../../lib/templates.js";

export class View {
    public static newTicket({
        slackId,
        permalink,
        recId,
        text,
    }: {
        slackId: string,
        permalink: string,
        recId: string,
        text: string,
    }): KnownBlock[] {
        return [
            {
                "type": "rich_text",
                "elements": [
                    {
                        "type": "rich_text_section",
                        "elements": [
                            {
                                "type": "text",
                                "text": "Review scrapbook by ",
                            },
                            {
                                "type": "user",
                                "user_id": slackId
                            }
                        ]
                    },
                    {
                        "type": "rich_text_quote",
                        "elements": [
                            {
                                type: "text",
                                "style": {
                                    "italic": true
                                },
                                "text": text
                            }
                        ]
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
                    "text": 
`<${permalink}|Preview>
<https://airtable.com/app4kCWulfB02bV8Q/tbl7FAJtLixWxWC2L/viwjGIE5EEQdBwLs7/${recId}|View on Airtable>`
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Start Review",
                        "emoji": true
                    },
                    "url": permalink,
                    "action_id": Actions.START_REVIEW
                }
            }
        ];
    }

    public static scrapbookOverview({
        slackId,
        scrapbookId
    }: {
        slackId: string,
        scrapbookId: string 
    }): KnownBlock[] {
        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    // "text": `Review started by <@${body.user.id}>.`
                    "text": t('review.start', { slackId })
                }
            },
            // {
            //     "type": "context",
            //     "elements": [
            //         {
            //             "type": "mrkdwn",
            //             "text": `<https://airtable.com/app4kCWulfB02bV8Q/tbl7FAJtLixWxWC2L/viwjGIE5EEQdBwLs7/${scrapbookId}|view on airtable>`
            //         }
            //     ]
            // }
        ];
    }

    public static userOverview({
        scrapbookId,
        hours,
        sessions,
        reviewed,
        flagged,
        category,
        notes
    }: {
        scrapbookId: string,
        hours: number,
        sessions: number,
        reviewed: number,
        flagged: string,
        category: string,
        notes: string
    }): KnownBlock[] {
        return [
            {
                "type": "section", 
                "text": {
                    "type": "mrkdwn",
                    "text":
`*User Overview* ${pfps['info']}
total hours logged: ${formatHour(hours)} hours
total hours approved: ${formatHour(reviewed)} hours
sessions: ${sessions}
flag: ${flagged == `✅ Didn't Commit Fraud` ? `none` : flagged}
user category: ${category}
notes: ${notes}
${hours <= 5*60 ? `woah, looks like they're just getting started! ${pfps['woah']}` : `they've been at it for a while now! ${pfps['thumbs']}`}`
                }                    
            }, 
            {
                "type": "divider"
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Magic Happening :sparkles:",
                            "emoji": true
                        },
                        "action_id": Actions.MAGIC,
                        "value": scrapbookId
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": `unsubmit :bangbang:`,
                            "emoji": true,
                        },
                        "style": "danger",
                        "action_id": Actions.UNSUBMIT,
                        "value": scrapbookId,

                        "confirm": {
                            "title": {
                                "type": "plain_text",
                                "text": `are you sure? ${pfps['freaking']}`,
                                "emoji": true
                            },
                            "confirm": {
                                "type": "plain_text",
                                "text": "yes, unsubmit",
                            },
                            "deny": {
                                "type": "plain_text",
                                "text": "i shouldn't have clicked that",
                            },
                            "text": {
                                "type": "mrkdwn",
                                "text": "woah bud, this will remove all sessions linked to this scrapbook. are you sure?"
                            }
                        }
                    }
                ]
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": `<https://airtable.com/app4kCWulfB02bV8Q/tbl7FAJtLixWxWC2L/viwjGIE5EEQdBwLs7/${scrapbookId}|view on airtable>`
                    }
                ]
            }
        ];
    }

    public static isShip(
        { recId }: { recId: string }
    ): KnownBlock[] {
        return [
            {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Is this project a ship?",
                    "emoji": true
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Yes (Shipped)",
                            "emoji": true
                        },
                        "action_id": Actions.SHIP,
                        "value": recId
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "No (WIP)",
                            "emoji": true
                        },
                        "action_id": Actions.WIP,
                        "value": recId
                    }
                ]
            }
        ]
    }

    public static session({
        createdAt,
        minutes,
        text,
        link,
        recId,
        urls,
        evidence,
        images
    }: {
        recId: string

        createdAt: string,
        minutes: number,
        link: string,

        text: string,
        evidence: string,
        urls?: string[],
        images?: string[]
    }): KnownBlock[] {
        const blocks: KnownBlock[] = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `${new Date(createdAt).toDateString().toLowerCase()} - ${minutes} minutes ${randomChoice([
                        pfps['woah'],
                        pfps['cute'],
                        pfps['thumbs'],
                        pfps['info']
                    ])}`,
                    "emoji": true
                }
            },            
        ];

        blocks.push({
            "type": "rich_text",
            "elements": [
                {
                    "type": "rich_text_preformatted",
                    "elements": [
                        {
                            type: "text",
                            "text": text ? text : "no text provided"
                        }
                    ]
                },
                // {
                //     "type": "rich_text_preformatted",
                //     "elements": [
                //         {
                //             type: "text",
                //             "text": evidence.length > 0 ? evidence : "no messages sent"
                //         }
                //     ]
                // },
                // ...(urls ? [{
                //     "type": "rich_text_quote",
                //     "elements": urls.map(url => ({
                //         "type": "link",
                //         "text": url + '\n',
                //         "url": url,
                //     }))
                // }] as RichTextQuote[] : []),
                // {
                //     "type": "rich_text_section",
                //     "elements": [
                //         {
                //             "type": "link",
                //             "text": `view session`,
                //             "url": link,
                //             "style": {
                //                 "bold": true
                //             }
                //         },
                //     ]
                // }
            ]
        });

        if (urls) {
            blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `urls:\n${urls.join('\n')}`
                }
            });
        }

        // blocks.push({
        //     "type": "section",
        //     "text": {
        //         "type": "mrkdwn",
        //         "text": `view session: <${link}|here>`
        //     }
        // }, {
        //     "type": "section",
        //     "text": {
        //         "text": `<https://airtable.com/app4kCWulfB02bV8Q/tbl2q5GGdwv252A7q/viwe3w2MTPRpa9uSB/${recId}|override on airtable>`,
        //         "type": "mrkdwn"
        //     }
        // });
        blocks.push({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": `<${link}|open in slack> • <https://airtable.com/app4kCWulfB02bV8Q/tbl2q5GGdwv252A7q/viwe3w2MTPRpa9uSB/${recId}|override on airtable>`
                }
            ]
        });


        // images break the bot...

        // if (images) {
        //     images.forEach(image => {
        //         blocks.push({
        //             "type": "image",
        //             "image_url": image,
        //             "alt_text": "screenshot"
        //         });
        //     });
        // }

        blocks.push(
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Approve 100% (60/60min)",
                            "emoji": true
                        },
                        "value": "100",
                        "action_id": Actions.APPROVEMIN100
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Approve 75% (45/60min)",
                            "emoji": true
                        },
                        "value": "75",
                        "action_id": Actions.APPROVEMIN75
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Approve 50% (30/60min)",
                            "emoji": true
                        },
                        "value": "50",
                        "action_id": Actions.APPROVEMIN50
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Approve 25% (15/60min)",
                            "emoji": true
                        },
                        "value": "25",
                        "action_id": Actions.APPROVEMIN25
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
                            "text": `reject ${pfps['peefest']}`,
                            "emoji": true
                        },
                        "value": recId, 
                        "action_id": Actions.REJECT
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": `reject & lock ${pfps['ded']}`,    
                            "emoji": true
                        },
                        "value": recId,
                        "action_id": Actions.REJECT_LOCK
                    }
                ]
            }, {
                "type": "divider"
            });

        return blocks;
    }

    public static approved({
        sessionId,
        minutes,
        createdAt,
        slackId
    }: {sessionId: string, minutes: number, createdAt: string, slackId?: string}) {
        return [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `${new Date(createdAt).toDateString().toLowerCase()} - ${minutes} minutes ${randomChoice([
                        pfps['woah'],
                        pfps['cute'],
                        pfps['thumbs'],
                        pfps['info']
                    ])}`,
                    "emoji": true
                }
            },  
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    // "text": `Approved ${slackId ? `by <@${slackId}>` : ` session!`}`
                    "text": (slackId ? t('review.reviewer.approved', { slackId, 
                        minutes: minutes ?? 0
                    }) : t('review.preset.approved', { minutes })) + `
view session: <https://airtable.com/app4kCWulfB02bV8Q/tbl2q5GGdwv252A7q/viwe3w2MTPRpa9uSB/${sessionId}|here>`
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": `undo ${pfps['peefest']}`,
                        "emoji": true
                    },
                    "value": sessionId,
                    "action_id": Actions.UNDO
                }
            },
        ]
    }

    public static rejected({
        sessionId,
        minutes,
        createdAt,
        slackId
    }: {sessionId: string, minutes: number, createdAt: string, slackId?: string}) {
        return [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `${new Date(createdAt).toDateString().toLowerCase()} - ${minutes} minutes ${randomChoice([
                        pfps['woah'],
                        pfps['cute'],
                        pfps['thumbs'],
                        pfps['info']
                    ])}`,
                    "emoji": true
                }
            },  
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    // "text": `Rejected ${slackId ? `by <@${slackId}>` : ` session!`}`
                    "text": slackId ? t('review.reviewer.rejected', { slackId, minutes }) : t('review.preset.rejected', { minutes }) + `
view session: <https://airtable.com/app4kCWulfB02bV8Q/tbl2q5GGdwv252A7q/viwe3w2MTPRpa9uSB/${sessionId}|here>`
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": `undo ${pfps['peefest']}`,
                        "emoji": true
                    },
                    "value": sessionId,
                    "action_id": Actions.UNDO
                }
            },
        ]
    }

    public static rejectedLock({
        sessionId,
        minutes,
        createdAt,
        slackId
    }: {sessionId: string, minutes: number, createdAt: string, slackId?: string}) {
        return [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `${new Date(createdAt).toDateString().toLowerCase()} - ${minutes} minutes ${randomChoice([
                        pfps['woah'],
                        pfps['cute'],
                        pfps['thumbs'],
                        pfps['info']
                    ])}`,
                    "emoji": true
                }
            },  
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    // "text": `Rejected and locked ${slackId ? `by <@${slackId}>` : ` session!`}`
                    "text": slackId ? t('review.reviewer.rejectedlocked', { slackId, minutes }) : t('review.preset.rejectedlocked', { minutes }) + `
<https://airtable.com/app4kCWulfB02bV8Q/tbl2q5GGdwv252A7q/viwe3w2MTPRpa9uSB/${sessionId}|override on airtable>`
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": `undo ${pfps['peefest']}`,
                        "emoji": true
                    },
                    "value": sessionId,
                    "action_id": Actions.UNDO
                }
            },
        ]
    }

    public static gimme(): KnownBlock[] {
        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "ready for the next review? (CLICK YES ONLY ONCE)"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": `yes ${pfps['cute']}`,
                            "emoji": true
                        },
                        "action_id": Actions.NEXT_REVIEW
                    }
                ]
            }
        ]
    }

    public static approveMinutesModal({ sessionId } : { sessionId: string }): ModalView {
        return {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "Approve Minutes",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Cancel",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Approve 100% (60/60min)",
                                "emoji": true
                            },
                            "value": "100",
                            "action_id": Actions.APPROVEMIN
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
                                "text": "Approve 75% (45/60min)",
                                "emoji": true
                            },
                            "value": "75",
                            "action_id": Actions.APPROVEMIN
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
                                "text": "Approve 50% (30/60min)",
                                "emoji": true
                            },
                            "value": "50",
                            "action_id": Actions.APPROVEMIN
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
                                "text": "Approve 25% (15/60min)",
                                "emoji": true
                            },
                            "value": "25",
                            "action_id": Actions.APPROVEMIN
                        }
                    ]
                }
            ],
            "private_metadata": sessionId,
        };
    }

    public static approveMinutesMessageModal({ minutes } : { minutes: number }): ModalView {
        return {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "Approve Minutes",
                "emoji": true
            },
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
                        "text": `Approving ${minutes}%! (${(minutes/100)*60}/60min)`
                    }
                }
            ]
        };
    }

    
}
