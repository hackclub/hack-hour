import { app } from "../../../lib/bolt.js";
import { prisma, uid } from "../../../lib/prisma.js";

import { Goals } from "../views/goals.js";
import { Constants, Actions, Callbacks, Environment } from "../../../lib/constants.js";
import { informUser, updateController } from "../lib/lib.js";
import { emitter } from "../../../lib/emitter.js";

app.action(Actions.OPEN_GOAL, async ({ ack, body, client }) => {
    try {
        const slackId: string = body.user.id;
        const trigger_id: string = (body as any).trigger_id;

        const userId = await prisma.user.findFirst({
            where: {
                slackUser: {
                    slackId: slackId
                }
            }
        });

        if (!userId) {
            // Post an ephemeral message to the user telling that they are not registered
            await ack();

            if (!body.channel || !body.channel.id) {
                throw new Error(`Channel not found`);
            }

            informUser(slackId, "This is not your session!", body.channel.id, (body as any).message.ts);

            return;
        }

        await ack();

        await client.views.open({
            trigger_id: trigger_id,
            view: await Goals.main(userId.id)
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});

app.action(Actions.SELECT_GOAL, async ({ ack, body, client }) => {
    try {
        const goalId = (body as any).actions[0].selected_option.value;

        await prisma.goal.updateMany({
            where: {
                selected: true
            },
            data: {
                selected: false
            }
        });

        const goalData = await prisma.goal.update({
            where: {
                id: goalId
            },
            data: {
                selected: true
            }
        });

        await ack();

        await client.views.update({
            view_id: (body as any).view.root_view_id,
            view: await Goals.main(goalData.userId)
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});

app.view(Callbacks.MAIN_GOAL, async ({ ack }) => {
    await ack();
});

app.action(Actions.CREATE_GOAL, async ({ ack, body, client }) => {
    try {
        await ack();

        const trigger_id: string = (body as any).trigger_id;

        await client.views.push({
            trigger_id: trigger_id,
            view: await Goals.create()
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});

app.view(Callbacks.CREATE_GOAL, async ({ ack, body, view, client }) => {
    try {
        const slackId = body.user.id;

        const goalName = view.state.values.goal_name.name.value;

        if (!goalName) {
            await ack({
                response_action: 'errors',
                errors: {
                    goal_name: 'Please enter a goal name'
                }
            });

            return;
        }

        await ack();

        const user = await prisma.user.findFirst({
            where: {
                slackUser: {
                    slackId: slackId
                }
            }
        });

        if (!user) {
            // User should not have been able to get here
            throw new Error(`User with slackId ${slackId} not found`);
        }

        await prisma.goal.updateMany({
            where: {
                userId: user.id
            },
            data: {
                selected: false
            }
        });

        const goal = await prisma.goal.create({
            data: {
                id: uid(),
                
                name: goalName,
                description: "", // TODO

                createdAt: new Date(),
                selected: true,

                totalMinutes: 0,
                
                user: {
                    connect: {
                        id: user.id
                    }
                }
            }
        });

        if (!goal) {
            // User should not have been able to get here
            throw new Error(`Goal with name ${goalName} not created`);
        }

        if (!body.view.root_view_id) {
            // User should not have been able to get here
            throw new Error(`Root view not found`);
        }

        // Update root view with new goal
        await client.views.update({
            view_id: body.view.root_view_id,
            view: await Goals.main(user.id)
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});

app.action(Actions.DELETE_GOAL, async ({ ack, body, client }) => {
    try {
        const goalId = (body as any).actions[0].value;

        const trigger_id: string = (body as any).trigger_id;

        if (goalId === 'NONE') {
            await ack({
                response_action: 'errors',
                errors: {
                    goal_actions: 'Please select a goal to delete'
                }
            } as any);

            return;
        }

        // Ensure that it is not the last goal
        const goals = await prisma.goal.aggregate({
            where: {
                user: {
                    slackUser: {
                        slackId: body.user.id                    
                    }
                }
            },
            _count: true
        });

        if (goals._count === 1) {
            await ack({
                response_action: 'errors',
                errors: {
                    goal_actions: 'You cannot delete your last goal'
                }
            } as any);

            return;
        }

        await ack();

        await client.views.push({
            trigger_id: trigger_id,
            view: await Goals.delete(goalId)
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});

app.view(Callbacks.DELETE_GOAL, async ({ ack, body, view, client }) => {
    try {
        const goalId = body.view.private_metadata;

        await ack();

        const goalData = await prisma.goal.delete({
            where: {
                id: goalId
            }
        });

        const firstGoal = await prisma.goal.findFirst({
            where: {
                userId: goalData.userId
            }
        });

        if (!firstGoal) {
            throw new Error(`First goal not found`);
        }

        await prisma.goal.update({
            where: {
                id: firstGoal.id
            },
            data: {
                selected: true
            }
        });

        if (!body.view.root_view_id) {
            // User should not have been able to get here
            throw new Error(`Root view not found`);
        }

        await client.views.update({
            view_id: body.view.root_view_id,
            view: await Goals.main(goalData.userId)
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});