export const Templates = {
    minutesRemaining: [
        "it looks like <@${userId}> is getting more power this hour! `${minutes}` minutes remaining towork on:",
        "<@${userId}> is keeping the doctor away with this hack hour! `${minutes}` minutes remaining to work on:",
        "let's go! <@${userId}> has `${minutes}` minutes to work on:"            
    ],   
    completed: [
        "WOOOOO! YOU DID IT <@${userId}>!",
        "guess what? <@${userId}> finished their hour!",
        "<@${userId}>'s pretty wizard! they finished their hour!",
        "epic job <@${userId}>, you're done!"
    ],
    completedTopLevel: [
        "<@${userId}> finished working on:"
    ],    
    sessionReminder: [
        "time's ticking <@${userId}>, looks like you have `${minutes}` minutes left!",
        "you have `${minutes}` minutes left <@${userId}>! keep it up!",
        "almost there <@${userId}>, `${minutes}` minutes left! take a coffee break while you're at it!",
        "power through <@${userId}>! you have `${minutes}` minutes left!"        
    ],
    cancelled: [
        "yikes! <@${userId}> cancelled their hack hour!",
        "i'm really disappointed, but <@${userId}> ended their hack hour.",
        "what was I expecting when <@${userId}> aborted their hour early?",
        "<@${userId}> cancelled their hack hour early."        
    ],
    cancelledTopLevel: [
        "<@${userId}> stopped working on:"
    ],
}