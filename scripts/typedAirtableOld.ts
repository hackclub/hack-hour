import dotenv from 'dotenv';
dotenv.config();
// A typed wrapper over airtable API
import Airtable from "airtable";

const AIRTABLE_TOKEN = 'patDtl8D2woEp0lyc.2dda65e74fdd99224c365391942afa893729899e0bddcff78420f870a7621098';
const AIRTABLE_BASE = 'app1VxI7f3twOIs2g';

Airtable.configure({
    apiKey: AIRTABLE_TOKEN
});

if (!AIRTABLE_BASE) { throw new Error("No Airtable base provided"); }

const base = Airtable.base(AIRTABLE_BASE);
const users = base("V2: Users");
const ships = base("V2: Ships");
const sessions = base("V2: Sessions");
const banks = base("V2: Banks");
const man = base("Manual Session Submissions");

type AirtableRecordID = string;

type AirtableUserRead = {
    "Name": string,
    "Internal ID": string,
    "Slack ID": string,
    "Banked Minutes": number,
    "Ships": AirtableRecordID[],
    "Sessions": AirtableRecordID[],
    "Total balance (minutes)": number,
    "Approved": number, 
    "Minutes spent (incl. pending)": number,
    "Total available balance (minutes)": number   
};

type AirtableUserWrite = {
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
    "Code URL Base": string,
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
    "V2: Ships": AirtableRecordID[],
};

type AirtableBankWrite = {
    "Ship URL": string,
    "Goal Name": string,
    "Status": "Powered Ship!" | "Unreviewed" | "Unpowered Ship" | "YSWS Ship",
    "User": AirtableRecordID[],
    "Created At": string,
    "Sessions": AirtableRecordID[], 
    "Ship ID": string,
    "Error": string,
//    "Minutes": number,
};

type AirtableBankRead = {
    "Ship URL": string,
    "Goal Name": string,
    "Status": "Powered Ship!" | "Unreviewed" | "Unpowered Ship" | "YSWS Ship",
    "User": AirtableRecordID[],
    "Created At": string,
    "Sessions": AirtableRecordID[], 
    "Approved Minutes": number,
    "Ship ID": string,
};

type AirtableManRead = {
    "Code URL": string,
    "Code URL Base": string,
    "Slack ID": string,
    "Work": string,
    "Minutes": number,
    "Status": "Approved" | "Unreviewed" | "Rejected" | "Already in Sessions Base",
    "Created At": string,
};

type AirtableManWrite = {
    "Code URL": string,
    "Code URL Base": string,
    "Slack ID": string,
    "Work": string,
    "Minutes": number,
    "Status": "Approved" | "Unreviewed" | "Rejected" | "Already in Sessions Base",
    "Created At": string,
};


export const AirtableAPI = {
    User: {
        async fetch(id: string): Promise<{id: AirtableRecordID, fields: AirtableUserRead} | null> {
            const records = await users.select({
                filterByFormula: `{Slack ID} = "${id}"`
            }).all();

            if (records.length === 0) { return null; }
            return {id: records[0].id, fields: records[0].fields as AirtableUserRead};
        },

        /*
        async search(internalId: string): Promise<{id: AirtableRecordID, fields: AirtableUser} | null> {
            const records = await users.select({
                filterByFormula: `{Slack ID} = "${internalId}"`
            }).all();

            if (records.length === 0) { return null; }
            return {id: records[0].id, fields: records[0].fields as AirtableUser};
        },*/

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

        async fetchAll(): Promise<{id: AirtableRecordID, fields: AirtableUserRead}[]> {
            const records = await users.select().all();

            return records.map(record => ({id: record.id, fields: record.fields as AirtableUserRead}));
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
        },
        
        async fetchAll(): Promise<{id: AirtableRecordID, fields: AirtableSessionRead}[]> {
            const records = await sessions.select().all();

            return records.map(record => ({id: record.id, fields: record.fields as AirtableSessionRead}));
        }
    },
    Ship: {
        async fetch(recordId: string): Promise<{id: AirtableRecordID, fields: AirtableShipWrite} | null> {
            const record = await ships.find(recordId);

            if (!record) { return null; }

            return {id: record.id, fields: record.fields as AirtableShipRead};
        },

        async search(shipUrl: string): Promise<{id: AirtableRecordID, fields: AirtableShipRead} | null> {
            const records = await ships.select({
                filterByFormula: `{Ship URL} = "${shipUrl}"`
            }).all();

            if (records.length === 0) { return null; }

            return {id: records[0].id, fields: records[0].fields as AirtableShipRead};
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
    },
    Banks: {
        async fetch(recordId: string): Promise<{id: AirtableRecordID, fields: AirtableBankRead} | null> {
            const record = await banks.find(recordId);

            if (!record) { return null; }

            return {id: record.id, fields: record.fields as AirtableBankRead};
        },

        async search(shipUrl: string): Promise<{id: AirtableRecordID, fields: AirtableBankRead} | null> {
            const records = await banks.select({
                filterByFormula: `{Ship URL} = "${shipUrl}"`
            }).all();

            if (records.length === 0) { return null; }

            return {id: records[0].id, fields: records[0].fields as AirtableBankRead};
        },

        async create(ship: AirtableBankWrite): Promise<{id: AirtableRecordID, fields: AirtableBankWrite}> {
            const record = await banks.create([{
                "fields": ship
            }]);

            return {id: record[0].id, fields: record[0].fields as AirtableBankWrite};
        },

        async update(id: AirtableRecordID, ship: Partial<AirtableBankWrite>): Promise<{id: AirtableRecordID, fields: AirtableBankWrite}> {
            const records = await banks.update([{
                "id": id,
                "fields": ship
            }]);

            return {id: records[0].id, fields: records[0].fields as AirtableBankWrite};
        },

        async fetchAll(): Promise<{id: AirtableRecordID, fields: AirtableBankRead}[]> {
            const records = await banks.select().all();

            return records.map(record => ({id: record.id, fields: record.fields as AirtableBankRead}));
        }
    },
    Man: {
        async fetch(recordId: string): Promise<{id: AirtableRecordID, fields: AirtableManRead} | null> {
            const record = await man.find(recordId);

            if (!record) { return null; }

            return {id: record.id, fields: record.fields as AirtableManRead};
        },

        async search(shipUrl: string): Promise<{id: AirtableRecordID, fields: AirtableManRead} | null> {
            const records = await man.select({
                filterByFormula: `{Ship URL} = "${shipUrl}"`
            }).all();

            if (records.length === 0) { return null; }

            return {id: records[0].id, fields: records[0].fields as AirtableManRead};
        },

        async update(id: AirtableRecordID, session: Partial<AirtableManWrite>): Promise<{id: AirtableRecordID, fields: AirtableManWrite}> {
            const records = await man.update([{
                "id": id,
                "fields": session
            }]);

            return {id: records[0].id, fields: records[0].fields as AirtableManWrite};
        },
        
        async fetchAll(): Promise<{id: AirtableRecordID, fields: AirtableManRead}[]> {
            const records = await man.select().all();

            return records.map(record => ({id: record.id, fields: record.fields as AirtableManRead}));
        }        
    }
};
