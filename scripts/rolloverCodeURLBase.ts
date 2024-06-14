import { AirtableAPI as PowerHourAPI } from "./typedAirtableOld";
import { URL } from 'node:url';

/*
Steps:
- Run dedupe on manual submissions
- Run migration script

Goals:
- match manual submissions against automated & remove duplicates

Later:
U0756DZHJ74: !!! IMPORTANT !!!
THIS SESSION WAS ALREADY APPROVED BUT I BELIEVE I SHOULD HAVE GOTTEN 4 HOURS INSTEAD OF ONE, AS THE GRANT WAS APPROVED THE SAME DAY I SHIPPED, MONDAY, WHICH WAS FOR DOUBLE HOURS, BUT I ONLY GOT 1 HOUR FOR THE YSWS PROJECT, EVEN THOUGH THE BASE WAS 2 

*/


const manualSessions = await PowerHourAPI.Man.fetchAll();

// for (const manualSession of manualSessions) {

//     const codeURL = new URL(manualSession.fields["Code URL"]);

//     await PowerHourAPI.Man.update(manualSession.id, {
//         "Code URL Base": codeURL.pathname
//     });

//     console.log(`Updated ${manualSession.fields["Code URL"]} to ${codeURL.pathname}`);
// }

const sessions = await PowerHourAPI.Session.fetchAll();

// for (const session of sessions) {
//     console.log(session.id + " - " + session.fields["Code URL"]);

//     const codeURL = new URL(session.fields["Code URL"]);

//     await PowerHourAPI.Session.update(session.id, {
//         "Code URL Base": codeURL.pathname
//     });

//     console.log(`Updated ${session.fields["Code URL"]} to ${codeURL.pathname}`);
// }

const sessionBaseUrls = sessions.map(session => session.fields["Code URL Base"]);
const manualBaseUrls = (manualSessions.filter(
    manual => manual.fields["Status"] !== "Already in Sessions Base"
)).map(manual => manual.fields["Code URL Base"]);

const filteredArray = sessionBaseUrls.filter(value => manualBaseUrls.includes(value));

console.log(JSON.stringify(filteredArray, null, 2));

const recordsToUpdate = manualSessions.filter(
    manual => filteredArray.includes(manual.fields["Code URL Base"])
); 

for (const record of recordsToUpdate) {
    console.log(`Updating ${record.fields["Code URL Base"]} to "Already in Sessions Base"`);
    await PowerHourAPI.Man.update(record.id, {
        "Status": "Already in Sessions Base"
    });
}