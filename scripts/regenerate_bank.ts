import dotenv from 'dotenv';
dotenv.config();

import { AirtableAPI } from '../src/extensions/ship/airtable.js';
import { prisma, uid } from '../src/lib/prisma.js';
import { app } from '../src/lib/bolt.js';
import { Prisma } from '@prisma/client';
import { Environment } from '../src/lib/constants.js';


const fetchOrCreateUser = async (user: Prisma.UserGetPayload<{ include: { slackUser: true } }>) => {
    let airtableUser = await AirtableAPI.User.fetch(user.id);

    if (!user.slackUser) { throw new Error(`No slack user found for ${user.id}`); }

    if (!airtableUser) {
        const slackInfo = await app.client.users.info({
            user: user.slackUser.slackId
        });
        if (!slackInfo.user?.real_name) { throw new Error(`No user found for ${user.slackUser.slackId}`); }

        airtableUser = await AirtableAPI.User.create({
            "Name": slackInfo.user.real_name,
            "Internal ID": user.id,
            "Slack ID": user.slackUser.slackId,
            "Banked Minutes": 0,
            "Ships": [],
            "Sessions": []
        });
    }

    return airtableUser;
}

const sessions = await prisma.session.findMany({
    where: {
        OR: [
            {
                completed: true
            },
            {
                cancelled: true
            }
        ]
    }
});

const airtableSessions = await AirtableAPI.Session.fetchAll();

console.log(sessions.length);
console.log(airtableSessions.length);

for (const session of sessions) {
    if (!(session.metadata as any).airtable) {      
        const airtableUser = fetchOrCreateUser(session.user);

        const codeUrl = `https://slack.com/archives/${Environment.MAIN_CHANNEL}/p${session.messageTs.replace('.', '')}`;

        AirtableAPI.Session.create({
            "Code URL": codeUrl,
            "User": [airtableUser!.id],
            "Work": (session.metadata as any).work,
            "Minutes": session.elapsed,
            "Status": "Unreviewed",
            "Created At": string,
        });
    }
}

/*
for (const session of sessions) {

    /*
    if (!(session.metadata as any).airtable) {
        continue;
    }
    
    if (airtableSession?.fields['V2: Ships'].length === 0) {
        await prisma.session.update({
            where: {
                messageTs: session.messageTs
            },
            data: {
                bank: {
                    disconnect: true
                }
            }
        });
    }
    
}
/*
const banks = await prisma.bank.findMany({
    include: {
        sessions: {
            include: {
                goal: true,
            }
        },
        user: {
            include: {
                slackUser: true
            }
        }
    }
});


const fetchOrCreateUser = async (user: Prisma.UserGetPayload<{ include: { slackUser: true } }>) => {
    let airtableUser = await AirtableAPI.User.fetch(user.id);

    if (!user.slackUser) { throw new Error(`No slack user found for ${user.id}`); }

    if (!airtableUser) {
        const slackInfo = await app.client.users.info({
            user: user.slackUser.slackId
        });
        if (!slackInfo.user?.real_name) { throw new Error(`No user found for ${user.slackUser.slackId}`); }

        airtableUser = await AirtableAPI.User.create({
            "Name": slackInfo.user.real_name,
            "Internal ID": user.id,
            "Slack ID": user.slackUser.slackId,
            "Banked Minutes": 0,
            "Ships": [],
            "Sessions": []
        });
    }

    return airtableUser;
}

for (const bank of banks) {
    // Check if the bank exists in the airtable
    const shipTs = (bank.data as any).shipTs;
    const shipUrl = (bank.data as any).shipUrl;

    if (!shipUrl) {
        console.log(`Bank ${bank.id} has no shipUrl!!!!!!!!!!!!!`);
        continue;
    }

    const { id } = await fetchOrCreateUser(bank.user);

    if (!AirtableAPI.Ship.search(shipUrl)) {
        // Create it
        await AirtableAPI.Ship.create({
            "Ship URL": shipUrl,
            "User": [id],
            "Goal Name": bank.sessions[0].goal!.name,
            "Created At": new Date().toISOString(),
            "Status": "Unreviewed",
            "Sessions": sessions.map(session => {
                return (session.metadata as any).airtable.id;
            })
        });
    }
}
*/