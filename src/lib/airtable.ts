import dotenv from 'dotenv';
dotenv.config();

// A typed wrapper over airtable API

import Airtable, { FieldSet } from "airtable";
import Bottleneck from 'bottleneck';

Airtable.configure({
    apiKey: process.env.AIRTABLE_TOKEN
});

if (!process.env.AIRTABLE_BASE) { throw new Error("No Airtable base provided"); }

type AirtableRecordID = string;

type AirtableResponse<T> = {
    id: AirtableRecordID,
    fields: T
};

type AirtableUserWrite = {
    "Name"?: string,
    "Internal ID"?: string,
    "Slack ID": string,
    "Initial Banked Minutes"?: number,
    "Inital Order Refunded Minutes"?: number,

    "/shop"?: string,
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
    "Scrapbook": AirtableRecordID[],
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
    readonly "Fraud Formula": string
    readonly "User Category": string,
};

type AirtableReviewerRead = {
    "Name": string,
    "Scrapbook": AirtableRecordID[],
    "Slack ID": string,
}

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
    "Review Button TS"?: string,
};

type AirtableSessionRead = {
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
    "Reason": string,
    "Approved Minutes": number,
    "Scrapbook": [AirtableRecordID] | [],
    "Percentage Approved": number,
    "Scrapbook Approved": boolean,
    "Review Button TS"?: string,
    "User: Slack ID": [string],
};

export interface AirtableScrapbookWrite {
    "Scrapbook TS": string,
    "Scrapbook URL": string,
    "Sessions": AirtableRecordID[],
    "User": [AirtableRecordID],
    "Attachments": {
        "url": string
    }[],
    "Text": string,
    "Approved"?: boolean,
    "Magic Happening"?: boolean,
    "Reviewer": [AirtableRecordID] | [],
    "Review Start Time"?: string,
    "Review End Time"?: string,
    "Review TS"?: string,
    "Reviewed On": "Hakkuun" | "Airtable Interface" | "Other",
    "Is Shipped?"?: boolean,
    "Update type": "WIP" | "Ship",
    readonly "User: Slack ID": [string],
    readonly "Reviewer: Slack ID": [string],
};

export interface AirtableScrapbookRead extends Required<AirtableScrapbookWrite> {
    readonly "Count Approved Sessions": number,
    readonly "Count Unreviewed Sessions": number,
    readonly "Linked Sessions Count": number,
    readonly "Review Button TSs": string[],
    readonly "User: Slack ID": [string],
};

type AirtableAPIRead = {
    "App Name": string,
    "Endpoint": string,
    "Active": boolean,
};

const base = Airtable.base(process.env.AIRTABLE_BASE);
const users = base("Users");
const sessions = base("Sessions");
const scrapbooks = base("Scrapbook");
const reviewers = base("Reviewers");
const api = base("API");

// 5 req per second
const AirtableAPIFactory = {
    // Create
    create<T extends FieldSet>(table: Airtable.Table<FieldSet>, opName: string) {
        return async (record: Partial<T>): Promise<AirtableResponse<T>> => {
            console.log(`[AirtableAPI.${opName}.create] Creating ${JSON.stringify(record)}`)

            const now = Date.now();

            const records = await table.create([{
                "fields": record
            }]);

            console.log(`[AirtableAPI.${opName}.create] Took ${Date.now() - now}ms. Record is now ${records[0].id}`)

            return { id: records[0].id, fields: records[0].fields as T };
        };
    },

    // Read
    all<T>(table: Airtable.Table<FieldSet>, opName: string) {
        return async (): Promise<AirtableResponse<T>[]> => {

            console.log(`[AirtableAPI.${opName}.all] Finding all records`)

            const now = Date.now();

            const records = await table.select().all();

            console.log(`[AirtableAPI.${opName}.all] Took ${Date.now() - now}ms`)

            return records.map(record => ({ id: record.id, fields: record.fields as T }));
        };
    },

    filter<T>(table: Airtable.Table<FieldSet>, opName: string) {
        return async (filter: string): Promise<AirtableResponse<T>[]> => {
            console.log(`[AirtableAPI.${opName}.filter] Looking up ${filter}`)

            const now = Date.now();

            const records = await table.select({
                filterByFormula: filter
            }).all();

            console.log(`[AirtableAPI.${opName}.filter] Took ${Date.now() - now}ms`)

            return records.map(record => ({ id: record.id, fields: record.fields as T }));
        };
    },

    find<T>(table: Airtable.Table<FieldSet>, opName: string) {
        return async (record: string): Promise<AirtableResponse<T> | null> => {
            console.log(`[AirtableAPI.${opName}.find] Looking up ${record}`)

            const now = Date.now();

            const records = await table.find(record);

            console.log(`[AirtableAPI.${opName}.find] Took ${Date.now() - now}ms`)

            if (!records) { return null; }

            return { id: records.id, fields: records.fields as T };
        };
    },

    // Update
    update<T extends FieldSet>(table: Airtable.Table<FieldSet>, opName: string) {
        return async (id: AirtableRecordID, fields: Partial<T>): Promise<AirtableResponse<T>> => {
            console.log(`[AirtableAPI.${opName}.update] Updating ${id} with ${JSON.stringify(fields)}`)

            const now = Date.now();

            const records = await table.update([{
                "id": id,
                "fields": fields
            }]);

            console.log(`[AirtableAPI.${opName}.update] Took ${Date.now() - now}ms`)

            return { id: records[0].id, fields: records[0].fields as T };
        };
    },

    // Delete
    delete(table: Airtable.Table<FieldSet>, opName: string) {
        return async (id: AirtableRecordID): Promise<void> => {
            console.log(`[AirtableAPI.${opName}.delete] Deleting ${id}`)

            const now = Date.now();

            try {
                await users.destroy([id]);

                console.log(`[AirtableAPI.${opName}.delete] Took ${Date.now() - now}ms`)
            } catch (error) {
                console.error(error);
            }
        };
    }
}

export const AirtableAPI = {
    Reviewer: {
        all: AirtableAPIFactory.all<AirtableReviewerRead>(reviewers, "Reviewer"),
        filter: AirtableAPIFactory.filter<AirtableReviewerRead>(reviewers, "Reviewer"),
        create: AirtableAPIFactory.create<AirtableReviewerRead>(reviewers, "Reviewer"),
    },
    User: {
        find: AirtableAPIFactory.find<AirtableUserRead>(users, "User"),
        filter: AirtableAPIFactory.filter<AirtableUserRead>(users, "User"),

        async lookupById(id: string): Promise<AirtableResponse<AirtableUserRead> | null> {
            const records = await this.filter(`{Hack Hour ID} = "${id}"`);

            if (records.length === 0) { return null; }
            return { id: records[0].id, fields: records[0].fields as AirtableUserRead };
        },

        async lookupBySlack(slack: string): Promise<{ id: AirtableRecordID, fields: AirtableUserRead } | null> {
            const records = await this.filter(`{Slack ID} = "${slack}"`);

            if (records.length === 0) { return null; }
            return { id: records[0].id, fields: records[0].fields as AirtableUserRead };
        },
        create: AirtableAPIFactory.create<AirtableUserWrite>(users, "User"),
        update: AirtableAPIFactory.update<AirtableUserWrite>(users, "User"),
        delete: AirtableAPIFactory.delete(users, "User"),

        async isAuthorized(slackId: string): Promise<boolean> {
            const records = await this.filter(`AND({Slack ID} = "${slackId}", {API Authorization} = 1`);

            return records.length > 0;
        },
    },
    Session: {
        find: AirtableAPIFactory.find<AirtableSessionRead>(sessions, "Session"),
        create: AirtableAPIFactory.create<AirtableSessionWrite>(sessions, "Session"),
        update: AirtableAPIFactory.update<AirtableSessionWrite>(sessions, "Session"),
        findAll: AirtableAPIFactory.all<AirtableSessionRead>(sessions, "Session"),

        async fromScrapbook(scrapbook: AirtableRecordID): Promise<AirtableRecordID[]> {
            const records = await sessions.select({
                filterByFormula: `{Scrapbook: Record ID} = '${scrapbook}'`,
                sort: [{ field: "Created At", direction: "asc" }],
            }).all();

            return records.map(record => record.id);
        },

        filter: AirtableAPIFactory.filter<AirtableSessionRead>(sessions, "Session"),
    },
    Scrapbook: {
        find: AirtableAPIFactory.find<AirtableScrapbookRead>(scrapbooks, "Scrapbook"),
        filter: AirtableAPIFactory.filter<AirtableScrapbookRead>(scrapbooks, "Scrapbook"),

        async create(scrapbook: Partial<AirtableScrapbookWrite>): Promise<{ id: AirtableRecordID, fields: AirtableScrapbookWrite }> {
            console.log(`[AirtableAPI.Scrapbook.create] Creating ${scrapbook}`)

            const now = Date.now();

            const record = await scrapbooks.create([{
                "fields": scrapbook as any
            }]);

            console.log(`[AirtableAPI.Scrapbook.create] Took ${Date.now() - now}ms`)

            return { id: record[0].id, fields: record[0].fields as unknown as AirtableScrapbookWrite };
        },

        async update(id: AirtableRecordID, scrapbook: Partial<AirtableScrapbookWrite>): Promise<{ id: AirtableRecordID, fields: AirtableScrapbookWrite }> {
            console.log(`[AirtableAPI.Scrapbook.update] Updating ${id} with ${scrapbook}`)

            const now = Date.now();

            const records = await scrapbooks.update([{
                "id": id,
                "fields": scrapbook as any
            }]);

            console.log(`[AirtableAPI.Scrapbook.update] Took ${Date.now() - now}ms`)

            return { id: records[0].id, fields: records[0].fields as unknown as AirtableScrapbookWrite };
        },

        raw: scrapbooks,
    },
};

export const scrapbookMultifilter = async (filterRules: string[]) => {
    const filter = `AND(${filterRules.join(', ')})`

    // const records = await AirtableAPI.Scrapbook.filter(filter);
    const records = await scrapbooks.select({
        filterByFormula: filter,
        sort: [{ field: "Created At", direction: "asc" }],
    }).all();

    return records as unknown as {
        id: AirtableRecordID,
        fields: AirtableScrapbookRead
    }[];
}
