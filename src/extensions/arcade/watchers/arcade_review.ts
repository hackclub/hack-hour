// This handles figuring out what to post in #arcade-review

import { AirtableAPI } from "../../../lib/airtable.js"

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

const postScrapbookForReview = async (scrapbookRecord) => {
    // write your code here for posting!

    // returns the message ts of the post
}

const main = async () => {
    const scrapbooks = await getArcadeScrapbooksToReview()
    for (const scrapbook of scrapbooks) {
        const reviewTS = await postScrapbookForReview(scrapbook)
        await AirtableAPI.Scrapbook.update(scrapbook.id, {
            "Review TS": reviewTS
        })
    }
}

export default main