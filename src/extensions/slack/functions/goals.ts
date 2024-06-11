import { app } from "../../../lib/bolt.js";
import { prisma, uid } from "../../../lib/prisma.js";

import { Goals } from "../views/goals.js";
import { Actions, Callbacks } from "../../../lib/constants.js";
import { informUser, updateController, updateTopLevel } from "../lib/lib.js";
import { emitter } from "../../../lib/emitter.js";

app.action(Actions.OPEN_GOAL, async ({ ack, body, client }) => {
    try {
        const slackId: string = body.user.id;
        const trigger_id: string = (body as any).trigger_id;

        const session = await prisma.session.findUnique({
            where: {
                controlTs: (body as any).message.ts
            },
            include: {
                user: {
                    include: {
                        slackUser: true
                    }
                }
            }
        });

        if (!session) {
            throw new Error(`Session not found`);
        }

        if (!session.user.slackUser) {
            throw new Error(`Slack user not found`);
        }

        if (slackId !== session.user.slackUser.slackId) {
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
            view: await Goals.main(session.messageTs)
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});

app.action(Actions.SELECT_GOAL, async ({ ack, body, client }) => {
    try {
        const goalId = (body as any).actions[0].selected_option.value;
        const sessionTs = (body as any).view.private_metadata

        let session = await prisma.session.findUniqueOrThrow({
            where: {
                messageTs: sessionTs
            }
        });

        const oldGoal = await prisma.goal.findUniqueOrThrow({
            where: {
                id: session?.goalId as string
            }
        });

        await prisma.goal.updateMany({
            where: {
                selected: true
            },
            data: {
                selected: false
            }
        });

        const newGoal = await prisma.goal.update({
            where: {
                id: goalId
            },
            data: {
                selected: true,
            }
        });

        session = await prisma.session.update({
            where: {
                messageTs: sessionTs,
                goal: {
                    completed: false
                },
                bankId: null
            },
            data: {
                goal: {
                    connect: {
                        id: newGoal.id
                    }
                }
            }
        });

        if (session.completed || session.cancelled) {
            await prisma.goal.update({
                where: {
                    id: oldGoal.id
                },
                data: {
                    totalMinutes: {
                        decrement: session.elapsed
                    }
                }
            });

            await prisma.goal.update({
                where: {
                    id: newGoal.id
                },
                data: {
                    totalMinutes: {
                        increment: session.elapsed
                    }
                }
            });
        }

        await ack();

        updateTopLevel(session);
        updateController(session);

        await client.views.update({
            view_id: (body as any).view.root_view_id,
            view: await Goals.main(session.messageTs)
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

        const sessionTs = (body as any).view.private_metadata;
        const trigger_id: string = (body as any).trigger_id;

        await client.views.push({
            trigger_id: trigger_id,
            view: await Goals.create(sessionTs)
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});

app.view(Callbacks.CREATE_GOAL, async ({ ack, body, view, client }) => {
    try {
        const slackId = body.user.id;

        const sessionTs = body.view.private_metadata;
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

        const session = await prisma.session.findUniqueOrThrow({
            where: {
                messageTs: sessionTs
            }
        });

        const user = await prisma.user.findFirstOrThrow({
            where: {
                slackUser: {
                    slackId: slackId
                }
            }
        });

        await prisma.goal.updateMany({
            where: {
                userId: user.id
            },
            data: {
                selected: false
            }
        });

        // Check if goal already exists
        const existingGoal = await prisma.goal.findFirst({
            where: {
                name: goalName,
                completed: false,
                userId: user.id
            }
        });

        if (existingGoal) {
            // User should not have been able to get here
            await ack({
                response_action: 'errors',
                errors: {
                    goal_name: 'Goal with this name already exists'
                }
            });

            return;
        }

        // Check if the max number of goals has been reached
        const goals = await prisma.goal.findMany({
            where: {
                userId: user.id,
                completed: false
            }
        });

        if (goals.length > 9) {
            // User should not have been able to get here

            await ack({
                response_action: 'errors',
                errors: {
                    goal_name: 'You have reached the maximum number of goals'
                }
            });
            
            return;
        }

        await ack();

        const newGoal = await prisma.goal.create({
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

        if (!body.view.root_view_id) {
            // User should not have been able to get here
            throw new Error(`Root view not found`);
        }

        // Update root view with new goal
        await client.views.update({
            view_id: body.view.root_view_id,
            view: await Goals.main(sessionTs)
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});

app.action(Actions.DELETE_GOAL, async ({ ack, body, client }) => {
    try {

        const sessionTs = (body as any).view.private_metadata;

        const trigger_id: string = (body as any).trigger_id;

        const session = await prisma.session.findUniqueOrThrow({
            where: {
                messageTs: sessionTs
            },
            include: {
                goal: true
            }
        });

        if (!session) {
            throw new Error(`Session not found`);
        }

        if (!session.goal) {
            throw new Error(`Goal not found`);
        }

        // Ensure that it is not "No Goal"
        if (session.goal.name === 'No Goal') {
            await ack({
                response_action: 'errors',
                errors: {
                    goal_actions: 'You cannot delete "No Goal"'
                }
            } as any);

            return;
        }

        await ack();

        await client.views.push({
            trigger_id: trigger_id,
            view: await Goals.delete(sessionTs)
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});

app.view(Callbacks.DELETE_GOAL, async ({ ack, body, view, client }) => {
    try {
        const sessionTs = body.view.private_metadata;

        await ack();

        // Mark the goal as complete
        let session = await prisma.session.findUniqueOrThrow({
            where: {
                messageTs: sessionTs
            }
        });

        if (!session.goalId) {
            throw new Error(`Goal not found`);
        }

        const oldGoal = await prisma.goal.update({
            where: {
                id: session.goalId
            },
            data: {
                completed: true
            }
        });

        // Update the session with "No Goal"
        const noGoal = await prisma.goal.findFirstOrThrow({
            where: {
                userId: session.userId,
                name: "No Goal"
            }
        });

        session = await prisma.session.update({
            where: {
                messageTs: sessionTs
            },
            data: {
                goalId: noGoal.id
            }
        });

        if (!body.view.root_view_id) {
            // User should not have been able to get here
            throw new Error(`Root view not found`);
        }

        (await prisma.session.findMany({
            where: {
                goal: {
                    id: oldGoal.id                
                }
            }
        })).forEach(async (session) => {
            updateController(session);
            updateTopLevel(session);
        });


        if (session.completed || session.cancelled) {
            await prisma.goal.update({
                where: {
                    id: oldGoal.id
                },
                data: {
                    totalMinutes: {
                        decrement: session.elapsed
                    }
                }
            });

            await prisma.goal.update({
                where: {
                    id: noGoal.id
                },
                data: {
                    totalMinutes: {
                        increment: session.elapsed
                    }
                }
            });
        }        

        updateController(session);
        updateTopLevel(session);

        await client.views.update({
            view_id: body.view.root_view_id,
            view: await Goals.main(sessionTs)
        });
    } catch (error) {
        emitter.emit('error', error);
    }
});