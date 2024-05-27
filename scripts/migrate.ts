/*
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import cuid2 from '@paralleldrive/cuid2';

cuid2.init();
export const uid = () => { return cuid2.createId() };

const prisma = new PrismaClient();

type UserV1 = {
    "slackId": string, // "U04QD71QWS0",
    "totalMinutes": number, //1100,
    "tz": string, //"-18000",
    "remindersEnabled": number, // 1,
    "reminder": string, //"07:00",
    "selectedGoal": string, //"78ff72d0-d4c3-422d-837c-7defb9aa93c3",
    "eventId": string //"none"
}

const rawJsonFile = await fs.promises.readFile('./data/User_V2.json', 'utf8');

const usersV1: UserV1[] = JSON.parse(rawJsonFile)["User"];

/*
How this will work:
- Existing users: data will be added to existing info
- New users: user will be created with the data
*//*

// First go through existing users
const usersV3 = await prisma.user.findMany();

for (const userV3 of usersV3) {
    const slackUser = await prisma.slackUser.findUnique({
        where: {
            userId: userV3.id
        }
    });

    if (!slackUser) {
        console.log(`No slack user found for user ${userV3.id}`);
        continue;
    }

    const userV1 = usersV1.find(u => u.slackId === slackUser.slackId);

    if (!userV1) {
        console.log(`No data found for user ${slackUser.slackId}`);
        continue;
    }

    await prisma.user.update({
        where: {
            id: userV3.id
        },
        data: {
            lifetimeMinutes: userV3.lifetimeMinutes + userV1.totalMinutes,
        }
    });

    console.log(`Records of user ${userV1.slackId} updated`);
}

// Now create new users
for (const userV1 of usersV1) {
    const slackUser = await prisma.slackUser.findUnique({
        where: {
            slackId: userV1.slackId
        }
    });

    if (slackUser) {
        console.log(`User ${userV1.slackId} already exists`);
        continue;
    }

    await prisma.user.create({
        data: {
            id: uid(),
            apiKey: uid(),
            lifetimeMinutes: userV1.totalMinutes,
            
            slackUser: {
                create: {
                    slackId: userV1.slackId,
                    tz_offset: parseInt(userV1.tz),
                }
            },

            goals: {
                create: {
                    id: uid(),
                    createdAt: new Date(),

                    name: "No Goal",
                    description: "",

                    selected: false,
                    totalMinutes: 0
                }
            }
        }
    });

    console.log(`User ${userV1.slackId} created`);
}

// Now perform updates on goals from V1

type GoalV1 = {
    "goalId" : string, //"78ff72d0-d4c3-422d-837c-7defb9aa93c3",
    "slackId" : string, //"U04QD71QWS0",
    "goalName" : string, //"No Goal",
    "minutes" : number //386
}

const rawJsonFileGoals = await fs.promises.readFile('./data/Goals_V2.json', 'utf8');

const goalsV1: GoalV1[] = JSON.parse(rawJsonFileGoals)["Goals"];

for (const goalV1 of goalsV1) {
    const slackUser = await prisma.slackUser.findUnique({
        where: {
            slackId: goalV1.slackId
        }
    });

    if (!slackUser) {
        console.log(`No slack user found for goal ${goalV1.slackId}`);
        continue;
    }

    const user = await prisma.user.findUnique({
        where: {
            id: slackUser.userId,
        }
    });

    if (!user) {
        console.log(`No user found for goal ${goalV1.slackId}`);
        continue;
    }

    // Check if the user has a goal with the same name
    const existingGoal = await prisma.goal.findFirst({
        where: {
            name: goalV1.goalName,
            userId: user.id
        }
    });

    if (existingGoal) {
        await prisma.goal.update({
            where: {
                id: existingGoal.id
            },
            data: {
                totalMinutes: existingGoal.totalMinutes + goalV1.minutes
            }
        });

        console.log(`Goal ${goalV1.goalName} updated for user ${user.id}`);
        continue;
    }

    await prisma.goal.create({
        data: {
            id: uid(),
            createdAt: new Date(),

            name: goalV1.goalName,
            description: "",

            selected: false,
            totalMinutes: goalV1.minutes,

            user: {
                connect: {
                    id: user.id
                }
            }
        }
    });

    console.log(`Goal ${goalV1.goalName} created for user ${user.id}`);
}

console.log("Done!!!!");
*/