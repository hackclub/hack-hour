// This handles figuring out what to post in #arcade-review

import { AirtableAPI } from "../../../lib/airtable.js"
import { Review } from "../slack/review.js"

const getArcadeScrapbooksToReview = async () => {
    const filterRules = [
        '{Count Unreviewed Sessions} > 0',
        // 'NOT({Approved})',
        'BLANK() = Reviewer',
        'Blank() = {Review TS}',
        `RECORD_ID() = 'recKjFPT8CMeZV3F2'` // test record
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
        `RECORD_ID() = 'recKjFPT8CMeZV3F2'` // test record
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
        `RECORD_ID() = 'recKjFPT8CMeZV3F2'` // test record
    ]
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const main = async () => {
    const reviewJob = async () => {
        try {
            const scrapbooks = await getArcadeScrapbooksToReview();
            const scrapbook = scrapbooks[0];
            await Review.init(scrapbook.id);
        } catch(e) {
            console.error(e);
        }
        await sleep(1000 * 10); // wait 10 seconds
        return reviewJob() // run again
    }

    const approveJob = async () => {
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

    const garbageCollectionJob = async () => {

    }
}

export default main