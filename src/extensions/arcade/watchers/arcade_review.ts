// This handles figuring out what to post in #arcade-review

import { AirtableAPI } from "../../../lib/airtable.js"
import { Review } from "../slack/review.js"

const getArcadeScrapbooksToReview = async () => {
    const filterRules = [
        '{Count Unreviewed Sessions} > 0',
        'BLANK() = Reviewer',
        'Blank() = {Review TS}',
        `RECORD_ID() = 'recKjFPT8CMeZV3F2'` // test record
    ]
    // TODO: also include re-reviews in this list
    const filter = `AND(${filterRules.join(', ')})`
    const records = await AirtableAPI.Scrapbook.filter(filter)
    return records
}

const main = async () => {
    const scrapbooks = await getArcadeScrapbooksToReview();

    for (const scrapbook of scrapbooks) {
        await Review.init(scrapbook.id);
    }
}

export default main