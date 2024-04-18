export const Templates = {
    minutesRemaining: [
        "it looks like <@${userId}> is getting more power this hour! `${minutes}` minutes remaining to work on:",
        "<@${userId}> is keeping the doctor away with this hack hour! `${minutes}` minutes remaining to work on:",
        "let's go! <@${userId}> has `${minutes}` minutes to work on:"            
    ],   
    completed: [
        "WOOOOO! YOU DID IT <@${userId}>!",
        "guess what? <@${userId}> finished their hour!",
        "<@${userId}>'s pretty wizard! they finished their hour!",
        "epic job <@${userId}>, you're done!",
        "pretty wizard <@${userId}>! you finished your hour!",
        "have a nice break <@${userId}>! you finished your hour!"
    ],
    completedTopLevel: [
        "<@${userId}> finished working on:",
        "excellent work <@${userId}>! you completed:",
        "amazing! <@${userId}> is done with:",
        "you're a rockstar <@${userId}>! you finished working on:",
        "legendary <@${userId}>! you're done with:",
        "you're an epic wizard <@${userId}>! you're done magicking up with:"
    ],    
    sessionReminder: [
        "time's ticking <@${userId}>, looks like you have `${minutes}` minutes left!",
        "you have `${minutes}` minutes left <@${userId}>! keep it up!",
        "almost there <@${userId}>, `${minutes}` minutes left! take a coffee break while you're at it!",
        "power through <@${userId}>! you have `${minutes}` minutes left!",
        "you're amazing <@${userId}>! only `${minutes}` minutes left!",
        "impressive work! just `${minutes}` minutes left <@${userId}>!"
    ],
    cancelled: [
        "yikes! <@${userId}> cancelled their hack hour!",
        "i'm really disappointed, but <@${userId}> ended their hack hour.",
        "what was I expecting when <@${userId}> aborted their hour early?",
        "<@${userId}> cancelled their hack hour early.",
        "looks like <@${userId}> decided to stop early.",
        "oh no! <@${userId}> cancelled their hour!",
        "it's over for <@${userId}>"
    ],
    cancelledTopLevel: [
        "<@${userId}> stopped working on:",
        "<@${userId}> unexpectedly quit on:",
        "<@${userId}> decided to stop working on:",
        "<@${userId}> ended their session early on:"        
    ],
}