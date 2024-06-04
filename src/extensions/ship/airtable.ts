// A typed wrapper over airtable API
import Airtable from "airtable";

Airtable.configure({
    apiKey: process.env.AIRTABLE_TOKEN
});

if (!process.env.AIRTABLE_BASE) { throw new Error("No Airtable base provided"); }

const base = Airtable.base(process.env.AIRTABLE_BASE);
const users = base("V2: Users");
const ships = base("V2: Ships");
const sessions = base("V2: Sessions");

type AirtableRecordID = string;

type AirtableUser = {
    "Name": string,
    "Internal ID": string,
    "Slack ID": string,
    "Banked Minutes": number,
    "Ships": AirtableRecordID[],
    "Sessions": AirtableRecordID[]
};

type AirtableShipWrite = {
    "Ship URL": string,
    "Goal Name": string,
    "Status": "Powered Ship!" | "Unreviewed" | "Unpowered Ship" | "YSWS Ship",
    "User": AirtableRecordID[],
    "Created At": string,
    "Sessions": AirtableRecordID[], 
//    "Minutes": number,
};

type AirtableShipRead = {
    "Ship URL": string,
    "Goal Name": string,
    "Status": "Powered Ship!" | "Unreviewed" | "Unpowered Ship" | "YSWS Ship",
    "User": AirtableRecordID[],
    "Created At": string,
    "Sessions": AirtableRecordID[], 
    "Minutes": number,
};

type AirtableSessionWrite = {
    "Code URL": string,
    "User": AirtableRecordID[],
    "Work": string,
    "Minutes": number,
    "Status": "Approved" | "Unreviewed" | "Rejected",
    "Created At": string,
};

type AirtableSessionRead = {
    "Code URL": string,
    "User": AirtableRecordID[],
    "Work": string,
    "Minutes": number,
    "Status": "Approved" | "Unreviewed" | "Rejected",
    "Created At": string,
    "Reason": string,
};

export const AirtableAPI = {
    User: {
        async fetch(id: string): Promise<{id: AirtableRecordID, fields: AirtableUser} | null> {
            const records = await users.select({
                filterByFormula: `{Internal ID} = "${id}"`
            }).all();

            if (records.length === 0) { return null; }
            return {id: records[0].id, fields: records[0].fields as AirtableUser};
        },

        async create(user: AirtableUser): Promise<{id: AirtableRecordID, fields: AirtableUser}> {
            const record = await users.create([{
                "fields": user
            }]);

            return {id: record[0].id, fields: record[0].fields as AirtableUser};
        },

        async update(id: AirtableRecordID, user: Partial<AirtableUser>): Promise<{id: AirtableRecordID, fields: AirtableUser}> {
            const records = await users.update([{
                "id": id,
                "fields": user
            }]);

            return {id: records[0].id, fields: records[0].fields as AirtableUser};
        }
    },
    Session: {
        async fetch(record: string): Promise<{id: AirtableRecordID, fields: AirtableSessionRead} | null> {
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
        }
    },
    Ship: {
        async fetch(recordId: string): Promise<{id: AirtableRecordID, fields: AirtableShipWrite} | null> {
            const record = await ships.find(recordId);

            if (!record) { return null; }

            return {id: record.id, fields: record.fields as AirtableShipRead};
        },

        async create(ship: AirtableShipWrite): Promise<{id: AirtableRecordID, fields: AirtableShipWrite}> {
            const record = await ships.create([{
                "fields": ship
            }]);

            return {id: record[0].id, fields: record[0].fields as AirtableShipWrite};
        },

        async update(id: AirtableRecordID, ship: Partial<AirtableShipWrite>): Promise<{id: AirtableRecordID, fields: AirtableShipWrite}> {
            const records = await ships.update([{
                "id": id,
                "fields": ship
            }]);

            return {id: records[0].id, fields: records[0].fields as AirtableShipWrite};
        }
    }
};