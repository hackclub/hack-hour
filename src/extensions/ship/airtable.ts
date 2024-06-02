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

type AirtableShip = {
    "Ship URL": string,
    "Goal Name": string,
    "Status": "Approved" | "Unreviewed" | "Rejected",
    "User": AirtableRecordID[],
    "Created At": string,
    "Sessions": AirtableRecordID[],
    "Minutes": number,
};

type AirtableSession = {
    "Code URL": string,
    "User": AirtableRecordID[],
    "Work": "1",
    "Minutes": number,
    "Status": "Approved" | "Unreviewed" | "Rejected",
    "Created At": string,
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
        async fetch(id: string): Promise<{id: AirtableRecordID, fields: AirtableSession} | null> {
            const records = await sessions.select({
                filterByFormula: `{Internal ID} = "${id}"`
            }).all();

            if (records.length === 0) { return null; }
            return {id: records[0].id, fields: records[0].fields as AirtableSession};
        },

        async create(session: AirtableSession): Promise<{id: AirtableRecordID, fields: AirtableSession}> {
            const record = await sessions.create([{
                "fields": session
            }]);

            return {id: record[0].id, fields: record[0].fields as AirtableSession};
        },

        async update(id: AirtableRecordID, session: Partial<AirtableSession>): Promise<{id: AirtableRecordID, fields: AirtableSession}> {
            const records = await sessions.update([{
                "id": id,
                "fields": session
            }]);

            return {id: records[0].id, fields: records[0].fields as AirtableSession};
        }
    },
    Ship: {
        async fetch(id: string): Promise<{id: AirtableRecordID, fields: AirtableShip} | null> {
            const records = await ships.select({
                filterByFormula: `{Internal ID} = "${id}"`
            }).all();

            if (records.length === 0) { return null; }
            return {id: records[0].id, fields: records[0].fields as AirtableShip};
        },

        async create(ship: AirtableShip): Promise<{id: AirtableRecordID, fields: AirtableShip}> {
            const record = await ships.create([{
                "fields": ship
            }]);

            return {id: record[0].id, fields: record[0].fields as AirtableShip};
        },

        async update(id: AirtableRecordID, ship: Partial<AirtableShip>): Promise<{id: AirtableRecordID, fields: AirtableShip}> {
            const records = await ships.update([{
                "id": id,
                "fields": ship
            }]);

            return {id: records[0].id, fields: records[0].fields as AirtableShip};
        }
    }
};
