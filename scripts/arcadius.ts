import dotenv from "dotenv";
dotenv.config();

import Airtable from "airtable";

const hoursAirtable = new Airtable({
    apiKey: '',
}).base("app4kCWulfB02bV8Q")("Users");

hoursAirtable.create({
    "Name": "evil arcadius 2",
    "Email": "boorgumanitej@gmail.com",
    "Slack ID": "1234",    
    "Initial Banked Minutes": 180,
    "Flow Triggered By": "Arcadius",
}).catch((err) => {
    console.error(err);
});