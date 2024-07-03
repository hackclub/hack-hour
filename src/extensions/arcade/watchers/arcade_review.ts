// This handles figuring out what to post in #arcade-review

import { AirtableAPI } from "../../../lib/airtable.js";
import { Review } from "../slack/review.js";

const getArcadeScrapbooksToReview = async () => {
    const filterRules = [
        '{Count Unreviewed Sessions} > 0',
        // 'NOT({Approved})',
        'BLANK() = Reviewer',
        'BLANK() = {Review TS}',
        '{Reviewed On} = "Other"'
        // `RECORD_ID() = 'recKjFPT8CMeZV3F2'` // test record
    ]
    // TODO: also include re-reviews in this list
    const filter = `AND(${filterRules.join(', ')})`
    const records = await AirtableAPI.Scrapbook.filter(filter)
    return records
}

const getArcadeScrapbooksToApprove = async () => {
    const filterRules = [
        '{Count Unreviewed Sessions} = 0',
        'Approved != TRUE()',
        `{Reviewed On} = "Hakkuun"`
        // `RECORD_ID() = 'recKjFPT8CMeZV3F2'` // test record
    ]
    // TODO: also include re-reviews in this list
    const filter = `AND(${filterRules.join(', ')})`
    const records = await AirtableAPI.Scrapbook.filter(filter)
    return records
}

const getArcadeScrapbooksToGarbageCollect = async () => {
    const filterRules = [
        'NOT(Approved = TRUE())',
        'NOT(BLANK() = {Review TS})',
        // `RECORD_ID() = 'recKjFPT8CMeZV3F2'` // test record
    ]
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const main = async () => {
    const reviewJob = async (): Promise<void> => {
        console.log('Getting scrapbooks to review')
        try {
            const scrapbooks = await getArcadeScrapbooksToReview();
            const scrapbook = scrapbooks[0];

            if (scrapbook) {
                await Review.init(scrapbook.id);
            }
        } catch(e) {
            console.error(e);
        }
        await sleep(1000 * 60); // wait 1 min
        return reviewJob() // run again
    }
    reviewJob(); // intentionally not awaiting!

    const approveJob = async (): Promise<void> => {
        console.log('Checking completion of reviews')
        try {
            const scrapbooks = await getArcadeScrapbooksToApprove();
            for (const scrapbook of scrapbooks) {
                await Review.finishReview(scrapbook.id);
            }
        } catch(e) {
            console.error(e)
        }
        await sleep(1000 * 5); // wait 5 seconds
        return approveJob() // run again
    }
    approveJob(); // intentionally not awaiting!

    const garbageCollectionJob = async () => {
        console.log('Garbage collecting')
    }
}

export default main