import { express } from "../../lib/bolt.js";

import "./watchers/hackhour.js";
import "./watchers/airtable.js";
import { prisma } from "../../lib/prisma.js";

express.get('/api/hours', async (req, res) => {
    try {
        // Get type
        // ?id=hackhourId
        // ?slackId=U1234
        // ?record=airtableRecord
        const { id, slackId, record /*type*/ } = req.query;

        if (id) {
            const user = await prisma.user.findUniqueOrThrow({ where: { id: String(id) } });

            const approvedMinutes = await prisma.transaction.aggregate({
                where: {
                    userId: user.id,
                    type: "approved",
                },
                _sum: {
                    amount: true,
                }
            });

            return res.send(JSON.stringify({
                lifetime: user.lifetimeMinutes,
                approvedMinutes: approvedMinutes._sum.amount,
            }));
        } else if (slackId) {
            const user = await prisma.user.findFirstOrThrow({
                where: {
                    slackUser: {
                        slackId: String(slackId),
                    }
                }
            });

            const approvedMinutes = await prisma.transaction.aggregate({
                where: {
                    userId: user.id,
                    type: "approved",
                },
                _sum: {
                    amount: true,
                }
            });

            return res.send(JSON.stringify({
                lifetime: user.lifetimeMinutes,
                approvedMinutes: approvedMinutes._sum.amount,
            }));
        } else if (record) {
            const user = await prisma.user.findFirstOrThrow({
                where: {
                    metadata: {
                        path: ["airtable", "id"],
                        equals: String(record),
                    }
                }
            });

            const approvedMinutes = await prisma.transaction.aggregate({
                where: {
                    userId: user.id,
                    type: "approved",
                },
                _sum: {
                    amount: true,
                }
            });

            return res.send(JSON.stringify({
                lifetime: user.lifetimeMinutes,
                approvedMinutes: approvedMinutes._sum.amount,
            }));
        }
    } catch (error: any) {
        console.error(error);
        res.status(500).send({ error: error.message });
    }
});