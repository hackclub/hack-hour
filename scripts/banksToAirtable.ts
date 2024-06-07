import dotenv from 'dotenv';
dotenv.config();

import { AirtableAPI } from '../src/extensions/ship/airtable.js';
import { prisma, uid } from '../src/lib/prisma.js';
import { app } from '../src/lib/bolt.js';
import { Prisma } from '@prisma/client';

const fetchOrCreateUser = async (user: Prisma.UserGetPayload<{ include: { slackUser: true } }>) => {
    let airtableUser = await AirtableAPI.User.fetch(user.id);

    if (!user.slackUser) { throw new Error(`No slack user found for ${user.id}`); }

    if (!airtableUser) {
        const slackInfo = await app.client.users.info({
            user: user.slackUser.slackId
        });
        if (!slackInfo.user?.real_name) { throw new Error(`No user found for ${user.slackUser.slackId}`); }

        console.log(`Creating bank ${user.id}`);

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

if (process.env.UPD_SCRPT) {
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
        },
        "orderBy": {
            "createdAt": "asc"
        }
    });

    for (let bank of banks) {
        const shipTs = (bank.data as any).shipTs;
        const shipUrl = (bank.data as any).shipUrl;

        if (bank.data.record) {
            console.log(`Skipping bank ${bank.id}`);
            continue;
        }

        // Check if the message exists
        bank = await prisma.bank.update({
            where: {
                id: bank.id
            },
            data: {
                data: {
                    ...(bank.data as object),
                    exists: true
                }
            },
            include: {
                sessions: {
                    include: {
                        goal: true
                    }
                },
                user: {
                    include: {
                        slackUser: true
                    }
                }
            }
        });

        try {
            const result = await app.client.reactions.get({
                channel: 'C01504DCLVD',
                timestamp: shipTs,
                full: true
            });
        } catch (error) {
            try {
                const result = await app.client.reactions.get({
                    channel: 'C0M8PUPU6',
                    timestamp: shipTs,
                    full: true
                });
            } catch (error) {
                bank = await prisma.bank.update({
                    where: {
                        id: bank.id
                    },
                    data: {
                        data: {
                            ...(bank.data as object),
                            exists: false
                        }
                    },
                    include: {
                        sessions: {
                            include: {
                                goal: true
                            }
                        },
                        user: {
                            include: {
                                slackUser: true
                            }
                        }
                    }
                });
            }
        }

        // Loop through the bank's sessions, removing any that is not complete or cancelled
        for (const session of bank.sessions) {
            if (!session.completed && !session.cancelled) {
                await prisma.bank.update({
                    where: {
                        id: bank.id
                    },
                    data: {
                        sessions: {
                            disconnect: {
                                messageTs: session.messageTs
                            }
                        }
                    }
                });
            }
        }

        const airtableUser = await fetchOrCreateUser(bank.user);

        const goalName = bank.sessions.length == 0 ? "No Associated Goal/Empty" : bank.sessions[0].goal!.name;

        let airtableSessions = bank.sessions.map(s => (s.metadata as any).airtable.id)

        // Remove a bank item if it errs
        for (const session of airtableSessions) {
            try {
                const airtableSession = await AirtableAPI.Session.fetch(session);

                if (!airtableSession) {
                    airtableSessions = airtableSessions.filter(s => s !== session);
                } else {
                    console.log(airtableSession.fields);
                }
            } catch (error) {
                console.error(error);
                airtableSessions = airtableSessions.filter(s => s !== session);
            }

            console.log(airtableSessions);
        }

        // Add it to the airtable
        const { id } = await AirtableAPI.Banks.create({
            "Created At": bank.createdAt.toISOString(),
            "Goal Name": goalName,
            "Sessions": airtableSessions,
            "Ship URL": shipUrl,
            "Status": "Unreviewed" as "Unreviewed",
            "User": [airtableUser.id],
            "Ship ID": bank.id,
            "Error": (bank.data as any).exists ? "" : "Message not found",
        });

        // Update the bank with the airtable ID
        await prisma.bank.update({
            where: {
                id: bank.id
            },
            data: {
                data: {
                    ...(bank.data as object),
                    record: id
                }
            }
        });
    }
}

console.log('Done');