import dotenv from 'dotenv';
dotenv.config();

// A typed wrapper over airtable API

import Airtable from "airtable";
import { emitter } from './emitter.js';

Airtable.configure({
    apiKey: process.env.AIRTABLE_TOKEN
});

if (!process.env.AIRTABLE_BASE) { throw new Error("No Airtable base provided"); }

const base = Airtable.base(process.env.AIRTABLE_BASE);
const users = base("Users");
const sessions = base("Sessions");
const scrapbooks = base("Scrapbook");
const api = base("API");

type AirtableRecordID = string;

type AirtableUserWrite = {
    "Name"?: string,
    "Internal ID"?: string,
    "Slack ID": string,
    "Initial Banked Minutes"?: number,
    "Inital Order Refunded Minutes"?: number,

    "/shop"? : string,
};

/*
Balance (Minutes): it considers unfulfilled orders
Settled Balance (Minutes): Only includes fulfilled orders

Minutes (All): The sum of ALL sessions that belongs to the user (includes rejected)
Minutes (Approved): sum of approved and banked minutes
Minutes (Banked): sum of banked minutes (and filters to ensure it has a Scrapbook)
Initial Banked Minutes: Migrated from Hack Hour
Initial Order Refunded Minutes: Handles declined orders from Hack Hour
Total Earned (Minutes): Minutes (Banked) + the two initials
Total Earned (Hours): just converts minutes to hours
Spent (Minutes): Cost of fulfilled orders
Spent Incl. Pending (Minutes): Cost of orders, excluding ones declined.
*/
type AirtableUserRead = {
    "Name": string,
    "Internal ID": string,
    "Slack ID": string,
    "Ships": AirtableRecordID[],
    "Sessions": AirtableRecordID[],
    // "Minutes (All)": number,
    "Minutes (Approved)": number,
    "Minutes (Banked)": number,
    "Total Earned (Minutes)": number,
    "Spent Incl. Pending (Minutes)": number,
    "Balance (Minutes)": number,
    "dmChannel": string,
    "Minutes (Pending Approval)": number,
    "Spent Fulfilled (Minutes)": number,

    "Balance (Hours)": number,
    "In Pending (Minutes)": number,

    "Minutes (All)": number,
    "Minutes (Rejected)": number,
    // "Preexisting": boolean,
    "API Authorization": boolean,

    "Verification Status (from YSWS Verification User)": "Unknown" | "Not Eligible" | "Eligible L1" | "Eligible L2" | "Testing" | "",
};

type AirtableSessionWrite = {
    "Session ID": string,
    "Message TS": string,
    "Control TS": string,
    "Code URL": string,
    "User": [AirtableRecordID],
    "Work": string,
    "Minutes": number,
    "Status": "Approved" | "Unreviewed" | "Rejected" | "Banked" | "Requested Re-review" | "Rejected Locked",
    "Created At": string,
    "Evidenced": boolean,
    "Activity": boolean,
    "Reason"?: string,
    "Scrapbook"?: [AirtableRecordID] | [],
    "First Time"?: boolean,
};

type AirtableSessionRead = {
    "Session ID": string,
    "Message TS": string,
    "Control TS": string,
    "Code URL": string,
    "User": [AirtableRecordID],
    "Work": string,
    "Minutes": number,
    "Status": "Approved" | "Unreviewed" | "Rejected" | "Banked" | "Requested Re-review",
    "Created At": string,
    "Evidenced": boolean,
    "Activity": boolean,
    "Reason": string,
    "Approved Minutes": number,
    "Scrapbook": [AirtableRecordID] | [],
    "Percentage Approved": number,
    "Scrapbook Approved": boolean,
};

type AirtableScrapbookWrite = {
    "Scrapbook TS": string,
    "Scrapbook URL": string,
    "Sessions": AirtableRecordID[],
    "User": [AirtableRecordID],
    "Attachments": {
        "url": string
    }[],
    "Text": string
};

type AirtableScrapbookRead = AirtableScrapbookWrite;

type AirtableAPIRead = {
    "App Name": string,
    "Endpoint": string,
    "Active": boolean,
};

export const AirtableAPI = {
    User: {
        async find(record: string): Promise<{id: AirtableRecordID, fields: AirtableUserRead} | null> {
            console.log(`[AirtableAPI.User.find] Looking up ${record}`)
            
            const now = Date.now();

            const records = await sessions.find(record);

            if (!records) { return null; }

            console.log(`[AirtableAPI.User.find] Took ${Date.now() - now}ms`)

            return {id: records.id, fields: records.fields as AirtableUserRead};
        },

        async lookupById(id: string): Promise<{id: AirtableRecordID, fields: AirtableUserRead} | null> {
            console.log(`[AirtableAPI.User.lookupById] Looking up ${id}`)

            const now = Date.now();

            const records = await users.select({
                filterByFormula: `{Hack Hour ID} = "${id}"`
            }).all();

            console.log(`[AirtableAPI.User.lookupById] Took ${Date.now() - now}ms, returned ${records.length} records`)

            if (records.length === 0) { return null; }
            return {id: records[0].id, fields: records[0].fields as AirtableUserRead};
        },

        async lookupBySlack(slack: string): Promise<{id: AirtableRecordID, fields: AirtableUserRead} | null> {
            console.log(`[AirtableAPI.User.lookupBySlack] Looking up ${slack}`)

            const now = Date.now();

            const records = await users.select({
                filterByFormula: `{Slack ID} = "${slack}"`
            }).all();

            console.log(`[AirtableAPI.User.lookupBySlack] Took ${Date.now() - now}ms, returned ${records.length} records`)

            if (records.length === 0) { return null; }
            return {id: records[0].id, fields: records[0].fields as AirtableUserRead};
        },

        async create(user: AirtableUserWrite): Promise<{id: AirtableRecordID, fields: AirtableUserWrite}> {
            console.log(`[AirtableAPI.User.create] Creating ${user}`)

            const now = Date.now();

            const record = await users.create([{
                "fields": user
            }]);

            console.log(`[AirtableAPI.User.create] Took ${Date.now() - now}ms`)

            return {id: record[0].id, fields: record[0].fields as AirtableUserWrite};
        },

        async update(id: AirtableRecordID, user: Partial<AirtableUserWrite>): Promise<{id: AirtableRecordID, fields: AirtableUserWrite}> {
            console.log(`[AirtableAPI.User.update] Updating ${id} with ${user}`)

            const now = Date.now();

            const records = await users.update([{
                "id": id,
                "fields": user
            }]);

            // console.log(`[AirtableAPI.User.update] Took ${Date.now() - date)}ms`)

            return {id: records[0].id, fields: records[0].fields as AirtableUserWrite};
        },

        async findAll(): Promise<{id: AirtableRecordID, fields: AirtableUserRead}[]> {
            console.log(`[AirtableAPI.User.findAll] Finding all users`)

            const now = Date.now();

            const records = await users.select().all();

            console.log(`[AirtableAPI.User.findAll] Took ${Date.now() - now}ms`)

            return records.map(record => ({id: record.id, fields: record.fields as AirtableUserRead}));
        },

        async delete(id: AirtableRecordID): Promise<void> {
            console.log(`[AirtableAPI.User.delete] Deleting ${id}`)

            const now = Date.now();

            try {
                await users.destroy([id]);

                console.log(`[AirtableAPI.User.delete] Took ${Date.now() - now}ms`)
            } catch (error) {
                emitter.emit("error", error);
            }
        },

        async authorizedAPIUsers(): Promise<AirtableUserRead[]> {
            console.log(`[AirtableAPI.User.authorizedAPIUsers] Finding all users with API Authorization`)

            const now = Date.now();

            const records = await users.select({
                filterByFormula: `{API Authorization} = 1`
            }).all();

            console.log(`[AirtableAPI.User.authorizedAPIUsers] Took ${Date.now() - now}ms`)

            return records.map(record => record.fields as AirtableUserRead);
        }
    },
    Session: {
        async find(record: string): Promise<{id: AirtableRecordID, fields: AirtableSessionRead} | null> {
            console.log(`[AirtableAPI.Session.find] Looking up ${record}`)

            const now = Date.now();
            const records = await sessions.find(record);

            if (!records) { return null; }

            console.log(`[AirtableAPI.Session.find] Took ${Date.now() - now}ms`)

            return {id: records.id, fields: records.fields as AirtableSessionRead};
        },

        async create(session: AirtableSessionWrite): Promise<{id: AirtableRecordID, fields: AirtableSessionWrite}> {
            console.log(`[AirtableAPI.Session.create] Creating ${session}`)

            const now = Date.now();

            const record = await sessions.create([{
                "fields": session
            }]);

            console.log(`[AirtableAPI.Session.create] Took ${Date.now() - now}ms`);

            return {id: record[0].id, fields: record[0].fields as AirtableSessionWrite};
        },

        async update(id: AirtableRecordID, session: Partial<AirtableSessionWrite>): Promise<{id: AirtableRecordID, fields: AirtableSessionWrite} | null> {
            console.log(`[AirtableAPI.Session.update] Updating ${id} with ${JSON.stringify(session)}`)

            const now = Date.now();

            const records = await sessions.update([{
                "id": id,
                "fields": session
            }]).catch(error => { console.error(error); return null});

            console.log(`[AirtableAPI.Session.update] Took ${Date.now() - now}ms`);

            return records ? {id: records[0].id, fields: records[0].fields as AirtableSessionWrite} : null;
        },
        
        async findAll(): Promise<{id: AirtableRecordID, fields: AirtableSessionRead}[]> {
            console.log(`[AirtableAPI.Session.findAll] Finding all sessions`)

            const now = Date.now();

            const records = await sessions.select().all();

            console.log(`[AirtableAPI.Session.findAll] Took ${Date.now() - now}ms`)

            return records.map(record => ({id: record.id, fields: record.fields as AirtableSessionRead}));
        }
    },
    Scrapbook: {
        async find(record: string): Promise<{id: AirtableRecordID, fields: AirtableScrapbookRead} | null> {
            console.log(`[AirtableAPI.Scrapbook.find] Looking up ${record}`)

            const now = Date.now();

            const records = await scrapbooks.find(record);

            console.log(`[AirtableAPI.Scrapbook.find] Took ${Date.now() - now}ms`)

            if (!records) { return null; }

            return {id: records.id, fields: records.fields as unknown as AirtableScrapbookRead};
        },

        async create(scrapbook: AirtableScrapbookWrite): Promise<{id: AirtableRecordID, fields: AirtableScrapbookWrite}> {
            console.log(`[AirtableAPI.Scrapbook.create] Creating ${scrapbook}`)

            const now = Date.now();

            const record = await scrapbooks.create([{
                "fields": scrapbook as any
            }]);

            console.log(`[AirtableAPI.Scrapbook.create] Took ${Date.now() - now}ms`)

            return {id: record[0].id, fields: record[0].fields as unknown as AirtableScrapbookWrite};
        },

        async update(id: AirtableRecordID, scrapbook: Partial<AirtableScrapbookWrite>): Promise<{id: AirtableRecordID, fields: AirtableScrapbookWrite}> {
            console.log(`[AirtableAPI.Scrapbook.update] Updating ${id} with ${scrapbook}`)

            const now = Date.now();

            const records = await scrapbooks.update([{
                "id": id,
                "fields": scrapbook as any
            }]);

            console.log(`[AirtableAPI.Scrapbook.update] Took ${Date.now() - now}ms`)

            return {id: records[0].id, fields: records[0].fields as unknown as AirtableScrapbookWrite};
        },
    },    
    API: {
        async getAllActive(): Promise<{id: AirtableRecordID, fields: AirtableAPIRead}[]> {
            console.log(`[AirtableAPI.API.getAllActive] Finding all active APIs`)

            const now = Date.now();

            const records = await api.select({
                filterByFormula: `{Active} = 1`
            }).all();

            console.log(`[AirtableAPI.API.getAllActive] Took ${Date.now() - now}ms`)
            
            // Return a list of endpoints
            return records.map(record => ({id: record.id, fields: record.fields as AirtableAPIRead}));
        }    
    }
};

let authorizedAPIUsers = await AirtableAPI.User.authorizedAPIUsers();

export let authorizedSlackUsers = authorizedAPIUsers.map(user => user["Slack ID"]);
export let authorizedInternalUsers = authorizedAPIUsers.map(user => user["Internal ID"]);

emitter.on("hour", async () => {
    authorizedAPIUsers = await AirtableAPI.User.authorizedAPIUsers();
    authorizedSlackUsers = authorizedAPIUsers.map(user => user["Slack ID"]);
    authorizedInternalUsers = authorizedAPIUsers.map(user => user["Internal ID"]);
});