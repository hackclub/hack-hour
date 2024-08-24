import { AirtableAPI as PowerHourAPI } from "./typedAirtableOld";
import { AirtableAPI as ArcadeAPI } from "./airtable";

/*
steps:
1. fetch all users from old base
2. loop through each user - for each user, create a new user record in the new base

    - name
    - slackId
    - email
    - inital banked minutes <= (total available balance)

    - inital order refunded minutes (refunded minutes from orders that have been declined) (tomorrow thing0)

edge cases:
    - people who have unfufilled orders & have those orders declined will lose that money
        solution: 1. each day, we'll check the old orders table for declined orders
                  2. update the user in the new base to add back the lost money to the inital banked minutes
*/

// Leave for PROD

const PWusers = await PowerHourAPI.User.fetchAll();
const Ausers = await ArcadeAPI.User.findAll();

// for (const user of PWusers) {
//     console.log(`\nIdentifying user ${user.fields["Name"]}...`);
// }

for (const user of Ausers) {
    console.log(`\nIdentifying user ${user.fields["Name"]}...`);
}

// for (const user of users) {
//     const updatedUser = await ArcadeAPI.User.lookupBySlack(user.fields["Slack ID"]);

//     if (!updatedUser) { continue; }

//     console.log(`\nIdentifying user ${user.fields["Name"]}...`);
//     console.log(`   Their slack ID is ${user.fields["Slack ID"]}\n   ---`);
//     console.log(`   They have ${user.fields["Total available balance (minutes)"]} minutes available`);
//     console.log(`   They have ${user.fields["Refunded"]} minutes refunded`);
//     // await ArcadeAPI.User.create({
//     //     "Name": user.fields["Name"],
//     //     "Slack ID": user.fields["Slack ID"], 
//     //     "Initial Banked Minutes": user.fields["Total available balance (minutes)"],
//     // });


// }
// console.log("Done!");