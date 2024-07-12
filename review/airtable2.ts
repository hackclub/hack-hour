// A typed wrapper over airtable API

import Airtable, { FieldSet, Table } from "airtable";

Airtable.configure({
    apiKey: process.env.AIRTABLE_TOKEN
});

if (!process.env.AIRTABLE_BASE) { throw new Error("No Airtable base provided"); }

const base = Airtable.base(process.env.AIRTABLE_BASE);

class AirtableFactory<T> {
    table: Table<FieldSet>;

    constructor(private tableName: string) {
        this.table = base(tableName);
    }

    private async time(fn: (...args: any[]) => Promise<any>) {
        const now = Date.now();
        console.log(`[AirtableAPI.${this.tableName}.${fn.name}] Performing task`)
        const result = await fn();
        console.log(`[AirtableAPI.${this.tableName}.${fn.name}] Took ${Date.now() - now}ms`)
        return result;
    }

    async all(): Promise<{ id: string, fields: T }[]> {
        const records = await this.time(this.table.select().all());

        return records.map(record => ({ id: record.id, fields: record.fields as T }));
    }

}