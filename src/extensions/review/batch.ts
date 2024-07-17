import Airtable from "airtable";
import { AirtableAPI, AirtableScrapbookRead, AirtableScrapbookWrite } from "../../lib/airtable.js";

export class ScrapbookCache {
    // Cahche wrapper over slack
    public static cache: {
        [recId: string]: {
            id: string;
            fields: AirtableScrapbookRead;
        }
    } = {};

    public static async find(recId: string) {
        // if (this.cache[recId]) {
        //     return this.cache[recId];
        // }

        // const record = await AirtableAPI.Scrapbook.find(recId);
        
        // if (!record) {
        //     throw new Error(`Failed to get record ${recId}`);
        // }

        // this.cache[recId] = record;

        // return record;
        return await AirtableAPI.Scrapbook.find(recId);
    }

    public static async update(recId: string, record: Partial<AirtableScrapbookWrite>) {
        // if (!this.cache[recId]) {
        //     const fetchRecord = await AirtableAPI.Scrapbook.find(recId);

        //     if (!fetchRecord) {
        //         throw new Error(`Failed to update record ${recId}`);
        //     }

        //     this.cache[recId] = {
        //         id: recId,
        //         fields: {
        //             ...fetchRecord.fields,
        //             ...record
        //         }
        //     };
        // } else {
        //     this.cache[recId].fields = {
        //         ...this.cache[recId].fields,
        //         ...record
        //     };
        // }

        // return this.cache[recId];
        return await AirtableAPI.Scrapbook.update(recId, record);
    }

    public static async forcePush(recId: string) {
        // if (!this.cache[recId]) {
        //     return;
        // }

        // await AirtableAPI.Scrapbook.update(recId, this.cache[recId].fields);

        // delete this.cache[recId];
        // return;
        
        return await AirtableAPI.Scrapbook.find(recId);
    }

    public static async refresh(recId: string) {
        // this.forcePush(recId);
        // delete this.cache[recId];
        // return this.find(recId);
        return await AirtableAPI.Scrapbook.find(recId);
    }
}

// setTimeout(async () => {
//     for (const recId of Object.keys(ScrapbookCache.cache)) {
//         await ScrapbookCache.refresh(recId);
//     }
// }, 1000);