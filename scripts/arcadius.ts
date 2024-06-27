import dotenv from "dotenv";
dotenv.config();

import Airtable from "airtable";

const hoursAirtable = new Airtable({
    apiKey: 'patVUxTHohsrJmX02.30383e201931e539a475f80cc11bd3b6d3176fdb5901f97baffc88a275d06893'
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