// Scans for evidence in threads

import { text } from "body-parser";
import { Slack } from "../../../lib/bolt.js";
import { Environment } from "../../../lib/constants.js";
        
import getUrls from "get-urls";

/*
Evidence types:
- Screenshot (image)
- Link (onshape)
- Link (commit)
- Link (pr)

Required corrections:
- Link (github but NOT github commit)
*/
export const Evidence = {
    async fetch(messageTs: string, slackId: string) {
        const evidence = await Slack.conversations.replies({
            channel: Environment.MAIN_CHANNEL,
            ts: messageTs
        });
    
        if (!evidence || !evidence.messages) { throw new Error(`No evidence found for ${messageTs}`); }

        return evidence.messages.filter(message => message.user === slackId);
    },

    // Checkers

    async check({
        messageTs,
        slackId
    }: {
        messageTs: string,
        slackId: string
    }) {
        const evidence = await this.fetch(messageTs, slackId);

        const activity = await this.checkActivity(evidence);
        const image = await this.checkImage(evidence);
        const {
            links,
            onshape,
            github,
            githubCommit,
            githubPR
        } = await this.checkLinks(evidence);

        return {
            activity,
            evidenced: image || onshape || github || githubCommit || githubPR || links,

            links,
            image,
            onshape,
            github,
            githubCommit,
            githubPR
        };
    },

    async checkActivity(evidence: Awaited<ReturnType<typeof this.fetch>>) {
        return evidence.length > 0;
    },

    async checkImage(evidence: Awaited<ReturnType<typeof this.fetch>>) {
        return evidence.find(message => message.files ? message.files.length > 0 : false) !== undefined;
    },

    async checkLinks(evidence: Awaited<ReturnType<typeof this.fetch>>) {
        let links = false;
        let onshape = false;
        let github = false;
        let githubCommit = false;
        let githubPR = false;
        
        for (const message of evidence) {
            const urls = getUrls(message.text ? message.text : "");
            
            for (const url of urls) {
                links = true;

                if (await this.isURL(url)) {
                    if (await this.isOnShape(url)) {
                        onshape = true;
                    } else if (await this.isGH(url)) {
                        github = true;
                        if (await this.isGHCommit(url)) {
                            githubCommit = true;
                        }
                    }
                }
            }
        }

        return {
            links,
            onshape,
            github,
            githubCommit,
            githubPR
        };
    },

    // URL checkers

    async isURL(url: string) {
        return getUrls(url).size > 0;
    },

    async isGH(url: string) {
        return url.includes("github.com");
    },

    async isGHCommit(url: string) {
        // does it match the pattern of a github commit?
        // https://github.com/aboutdavid/hour-review-bot/commit/3779b6eb367169aab70fa6d2841791d85f8a8865
        // borrowed from https://stackoverflow.com/questions/53362454/regex-to-mach-github-commit-url
        return new RegExp('https://github\.com(?:/[^/]+)*/commit/[0-9a-f]{40}').test(url);
    },

    // async isGHPR(url: string) 

    async isOnShape(url: string) {
        return url.includes("cad.onshape.com");
    },

    // Grabbers
    async grabImages(evidence: Awaited<ReturnType<typeof this.fetch>>) {
        return evidence.map(message => message.files ? message.files : []).flat().filter(file => file.mimetype && file.mimetype.includes("image"));
    },

    async grabImageURLs(evidence: Awaited<ReturnType<typeof this.fetch>>) {
        return (await this.grabImages(evidence)).map(file => file.permalink_public).filter(i => i !== undefined);
    },

    async grabMessageText(evidence: Awaited<ReturnType<typeof this.fetch>>) {
        return evidence.map(message => message.text).filter(text => text !== undefined).filter(text => !this.isURL(text));
    },

    async grabLinks(evidence: Awaited<ReturnType<typeof this.fetch>>) {
        return evidence.map(message => this.getUrls(message.text ? message.text : "")).flat().filter(url => url !== undefined);
    },

    async grabOnShapeLinks(evidence: Awaited<ReturnType<typeof this.fetch>>) {
        return (await this.grabLinks(evidence)).filter(url => this.isOnShape(url));
    },

    async grabGHLinks(evidence: Awaited<ReturnType<typeof this.fetch>>) {
        return (await this.grabLinks(evidence)).filter(url => this.isGH(url));
    },

    async grabGHCommitLinks(evidence: Awaited<ReturnType<typeof this.fetch>>) {
        return (await this.grabGHLinks(evidence)).filter(url => this.isGHCommit(url));
    },
    
    // Helpers
    getUrls(message: string) {
        return Array.from(getUrls(message));
    }
}