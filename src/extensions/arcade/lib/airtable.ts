import dotenv from 'dotenv';
dotenv.config();

// A typed wrapper over airtable API

import Airtable from "airtable";

Airtable.configure({
    apiKey: process.env.AIRTABLE_TOKEN
});

if (!process.env.AIRTABLE_BASE) { throw new Error("No Airtable base provided"); }

const base = Airtable.base(process.env.AIRTABLE_BASE);
const users = base("Users");
// const ships = base("V2: Ships");
const sessions = base("Sessions");
// const banks = base("V2: Banks");

type AirtableRecordID = string;

type AirtableUserWrite = {
    "Name": string,
    "Hack Hour ID": string,
    "Slack ID": string,
};

type AirtableUserRead = {
    "Name": string,
    "Hack Hour ID": string,
    "Slack ID": string,
    "Ships": AirtableRecordID[],
    "Sessions": AirtableRecordID[]
};

// type AirtableShipWrite = {
//     "Ship URL": string,
//     "Goal Name": string,
//     "Status": "Powered Ship!" | "Unreviewed" | "Unpowered Ship" | "YSWS Ship",
//     "User": AirtableRecordID[],
//     "Created At": string,
//     "Sessions": AirtableRecordID[], 
// //    "Minutes": number,
// };

// type AirtableShipRead = {
//     "Ship URL": string,
//     "Goal Name": string,
//     "Status": "Powered Ship!" | "Unreviewed" | "Unpowered Ship" | "YSWS Ship",
//     "User": AirtableRecordID[],
//     "Created At": string,
//     "Sessions": AirtableRecordID[], 
//     "Minutes": number,
// };

type AirtableSessionWrite = {
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
    "Reason"?: string,
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
};

// type AirtableBankWrite = {
//     "Ship URL": string,
//     "Goal Name": string,
//     "Status": "Powered Ship!" | "Unreviewed" | "Unpowered Ship" | "YSWS Ship",
//     "User": AirtableRecordID[],
//     "Created At": string,
//     "Sessions": AirtableRecordID[], 
//     "Ship ID": string,
//     "Error": string,
// //    "Minutes": number,
// };

// type AirtableBankRead = {
//     "Ship URL": string,
//     "Goal Name": string,
//     "Status": "Powered Ship!" | "Unreviewed" | "Unpowered Ship" | "YSWS Ship",
//     "User": AirtableRecordID[],
//     "Created At": string,
//     "Sessions": AirtableRecordID[], 
//     "Approved Minutes": number,
//     "Ship ID": string,
// };

export const AirtableAPI = {
    User: {
        async find(record: string): Promise<{id: AirtableRecordID, fields: AirtableUserRead} | null> {
            const records = await sessions.find(record);

            if (!records) { return null; }

            return {id: records.id, fields: records.fields as AirtableUserRead};
        },

        async lookupById(id: string): Promise<{id: AirtableRecordID, fields: AirtableUserRead} | null> {
            const records = await users.select({
                filterByFormula: `{Hack Hour ID} = "${id}"`
            }).all();

            if (records.length === 0) { return null; }
            return {id: records[0].id, fields: records[0].fields as AirtableUserRead};
        },

        async create(user: AirtableUserWrite): Promise<{id: AirtableRecordID, fields: AirtableUserWrite}> {
            const record = await users.create([{
                "fields": user
            }]);

            return {id: record[0].id, fields: record[0].fields as AirtableUserWrite};
        },

        async update(id: AirtableRecordID, user: Partial<AirtableUserWrite>): Promise<{id: AirtableRecordID, fields: AirtableUserWrite}> {
            const records = await users.update([{
                "id": id,
                "fields": user
            }]);

            return {id: records[0].id, fields: records[0].fields as AirtableUserWrite};
        },

        async findAll(): Promise<{id: AirtableRecordID, fields: AirtableUserRead}[]> {
            const records = await users.select().all();

            return records.map(record => ({id: record.id, fields: record.fields as AirtableUserRead}));
        }
    },
    Session: {
        async find(record: string): Promise<{id: AirtableRecordID, fields: AirtableSessionRead} | null> {
            const records = await sessions.find(record);

            if (!records) { return null; }

            return {id: records.id, fields: records.fields as AirtableSessionRead};
        },

        async create(session: AirtableSessionWrite): Promise<{id: AirtableRecordID, fields: AirtableSessionWrite}> {
            const record = await sessions.create([{
                "fields": session
            }]);

            return {id: record[0].id, fields: record[0].fields as AirtableSessionWrite};
        },

        async update(id: AirtableRecordID, session: Partial<AirtableSessionWrite>): Promise<{id: AirtableRecordID, fields: AirtableSessionWrite}> {
            const records = await sessions.update([{
                "id": id,
                "fields": session
            }]);

            return {id: records[0].id, fields: records[0].fields as AirtableSessionWrite};
        },
        
        async findAll(): Promise<{id: AirtableRecordID, fields: AirtableSessionRead}[]> {
            const records = await sessions.select().all();

            return records.map(record => ({id: record.id, fields: record.fields as AirtableSessionRead}));
        }
    },
    // Ship: {
    //     async find(recordId: string): Promise<{id: AirtableRecordID, fields: AirtableShipWrite} | null> {
    //         const record = await ships.find(recordId);

    //         if (!record) { return null; }

    //         return {id: record.id, fields: record.fields as AirtableShipRead};
    //     },

    //     async search(shipUrl: string): Promise<{id: AirtableRecordID, fields: AirtableShipRead} | null> {
    //         const records = await ships.select({
    //             filterByFormula: `{Ship URL} = "${shipUrl}"`
    //         }).all();

    //         if (records.length === 0) { return null; }

    //         return {id: records[0].id, fields: records[0].fields as AirtableShipRead};
    //     },

    //     async create(ship: AirtableShipWrite): Promise<{id: AirtableRecordID, fields: AirtableShipWrite}> {
    //         const record = await ships.create([{
    //             "fields": ship
    //         }]);

    //         return {id: record[0].id, fields: record[0].fields as AirtableShipWrite};
    //     },

    //     async update(id: AirtableRecordID, ship: Partial<AirtableShipWrite>): Promise<{id: AirtableRecordID, fields: AirtableShipWrite}> {
    //         const records = await ships.update([{
    //             "id": id,
    //             "fields": ship
    //         }]);

    //         return {id: records[0].id, fields: records[0].fields as AirtableShipWrite};
    //     }
    // },
    // Banks: {
    //     async find(recordId: string): Promise<{id: AirtableRecordID, fields: AirtableBankRead} | null> {
    //         const record = await banks.find(recordId);

    //         if (!record) { return null; }

    //         return {id: record.id, fields: record.fields as AirtableBankRead};
    //     },

    //     async search(shipUrl: string): Promise<{id: AirtableRecordID, fields: AirtableBankRead} | null> {
    //         const records = await banks.select({
    //             filterByFormula: `{Ship URL} = "${shipUrl}"`
    //         }).all();

    //         if (records.length === 0) { return null; }

    //         return {id: records[0].id, fields: records[0].fields as AirtableBankRead};
    //     },

    //     async create(ship: AirtableBankWrite): Promise<{id: AirtableRecordID, fields: AirtableBankWrite}> {
    //         const record = await banks.create([{
    //             "fields": ship
    //         }]);

    //         return {id: record[0].id, fields: record[0].fields as AirtableBankWrite};
    //     },

    //     async update(id: AirtableRecordID, ship: Partial<AirtableBankWrite>): Promise<{id: AirtableRecordID, fields: AirtableBankWrite}> {
    //         const records = await banks.update([{
    //             "id": id,
    //             "fields": ship
    //         }]);

    //         return {id: records[0].id, fields: records[0].fields as AirtableBankWrite};
    //     },

    //     async findAll(): Promise<{id: AirtableRecordID, fields: AirtableBankRead}[]> {
    //         const records = await banks.select().all();

    //         return records.map(record => ({id: record.id, fields: record.fields as AirtableBankRead}));
    //     }
    // },
};