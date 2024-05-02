import { prisma, express } from "../app.js";

express.app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const user = await prisma.user.findUnique({
        where: {
            slackId: userId,
        },
    });

    if (user) {
        const userGoals = await prisma.goals.findMany({
            where: {
                slackId: userId,
            },
        });

        const goalsPayload = userGoals.map((goal) => {
            return {
                id: goal.goalId,
                name: goal.goalName,
                minutes: goal.minutes,                
            }
        });
    
        // Only send back non-sensitive information
        const userPayload = {
            totalMinutes: user.totalMinutes,
            selectedGoal: user.selectedGoal,
            event: user.eventId,
            goals: goalsPayload,
        }

        res.status(200).send(userPayload);
    } else {
        res.status(404).send('User not found');
    }
});