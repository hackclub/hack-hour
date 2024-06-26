// This handles figuring out what to post in #arcade-review

import { AirtableAPI } from "../../../lib/airtable.js"
import { Review } from "../slack/review.js"

const getArcadeScrapbooksToReview = async () => {
    const filterRules = [
        '{Count Unreviewed Sessions} > 0',
        'BLANK() = Reviewer',
        'Blank() = {Review TS}'
    ]
    const filter = `AND(${filterRules.join(', ')})`
    const records = await AirtableAPI.Scrapbook.filter(filter)
    return records
}

const main = async () => {
    const scrapbooks = await getArcadeScrapbooksToReview();

    for (const scrapbook of scrapbooks) {
        const reviewTS = await Review.init(scrapbook.fields)

        await Review.open(scrapbook.fields);
    }
}

export default main