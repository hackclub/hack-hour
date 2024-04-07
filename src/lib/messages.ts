// Messages :p
export const MessageTemplates = {
  // has `##` to remain
  minutesRemaining: [
    "it looks like <@<U>> is getting more power this hour! `<#>` minutes remaining to work on:\n<T>",
    "<@<U>> is keeping the doctor away with this hack hour! `<#>` minutes remaining to work on:\n<T>",
    "let's go! <@<U>> has `<#>` minutes to work on:\n<T>"    
  ],
  // <@> you have <##> minutes left
  minuteUpdate: [
    "time's ticking <@<U>>, looks like you have `<#>` minutes left!",
    "you have `<#>` minutes left <@<U>>! keep it up!",
    "almost there <@<U>>, `<#>` minutes left! take a coffee break while you're at it!",
    "power through <@<U>>! you have `<#>` minutes left!"
  ],
  // <@> has aborted their hack hour
  aborted: [
    "yikes! <@<U>> cancelled their hack hour!",
    "i'm really disappointed, but <@<U>> ended their hack hour.",
    "what was I expecting when <@<U>> aborted their hour early?",
    "<@<U>> \"finished\" early."
  ],
  // <@> has finished their hack hour
  finished: [
    "WOOOOO! YOU DID IT <@<U>>!",
    "guess what? <@<U>> finished their hour!",
    "<@<U>>'s pretty wizard! they finished their hour!",
    "epic job <@<U>>, you're done!"
  ],
  // You missed your check in!
  missedCheckIn: [
    "i'm so sad ): you didn't do an hour today",
    "looks like you didn't do an hour today ): maybe tomorrow"
  ]
}

export function randomSelect(templates: string[]): string {
  return templates[Math.floor(Math.random() * templates.length)];
}

export function formatMessage(message: string, data: {[key: string]: string}): string {  
  for (var key in data) {
    message = message.replace(new RegExp(`<${key}>`, 'g'), data[key]);
  }
  
  return message;
}    

export function genFunMessage(data: {[key: string]: string}, templates: string[]): string {
  // Randomly select a template & replace placeholders with data
  return formatMessage(randomSelect(templates), data);
}