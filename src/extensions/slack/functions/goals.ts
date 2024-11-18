import { Slack } from "../../../lib/bolt.js";
import { prisma, uid } from "../../../lib/prisma.js";

import { Goals } from "../views/goals.js";
import { Actions, Callbacks } from "../../../lib/constants.js";
import { informUser, updateController, updateTopLevel } from "../lib/lib.js";
import { emitter } from "../../../lib/emitter.js";
import { t } from "../../../lib/templates.js";
import { Loading } from "../views/loading.js";
import { Session } from "../../../lib/corelib.js";

Slack.action(Actions.OPEN_GOAL, async ({ body, client }) => {
    try {
        const slackId: string = body.user.id;
        const trigger_id: string = (body as any).trigger_id
        
        const view = await Slack.views.open({
            trigger_id: trigger_id,
            view: Loading.loading()
        });

        const session = await prisma.session.findFirstOrThrow({//findUnique({
            where: {
                messageTs: (body as any).message.thread_ts
            },
            include: {
                user: {
                    include: {
                        slackUser: true
                    }
                }
            }
        });
        
        if (!session.user.slackUser) {
            throw new Error(`Slack user not found`);
        }

        if (slackId !== session.user.slackUser.slackId) {
            // Post an ephemeral message to the user telling that they are not registered
            if (!body.channel || !body.channel.id) {
                throw new Error(`Channel not found`);
            }

            // informUser(slackId, t('error.not_yours'), body.channel.id, (body as any).message.ts);
            await client.views.update({
                view_id: view?.view?.id,
                view: Loading.error(t('error.not_yours'))
            });

            return;
        }

        // await client.views.open({
        //     trigger_id: trigger_id,
        //     view: await Goals.main(session.id)
        // });
        await client.views.update({
            view_id: view?.view?.id,
            view: await Goals.main(session.id)
        });
    } catch (error) {
        emitter.emit('error', {error});
    }
});

Slack.action(Actions.SELECT_GOAL, async ({ body, client }) => {
    try {
        const goalId = (body as any).actions[0].selected_option.value;
        const sessionId = (body as any).view.private_metadata

        let session = await prisma.session.findUniqueOrThrow({
            where: {
                id: sessionId
            }
        });

        session = await Session.changeGoal(session, goalId);

        await client.views.update({
            view_id: (body as any).view.root_view_id,
            view: await Goals.main(session.id)
        });
    } catch (error) {
        emitter.emit('error', {error});
    }
});

Slack.view(Callbacks.MAIN_GOAL, async ({}) => {});

Slack.action(Actions.CREATE_GOAL, async ({ body, client }) => {
    try {
        const sessionId = (body as any).view.private_metadata;
        const trigger_id: string = (body as any).trigger_id;

        await Slack.views.push({
            trigger_id: trigger_id,
            view: await Goals.create(sessionId)
        });
    } catch (error) {
        emitter.emit('error', {error});
    }
});

Slack.view(Callbacks.CREATE_GOAL, async ({ body, view, client }) => {
    try {
        const slackId = body.user.id;

        const sessionId = body.view.private_metadata;
        const goalName = view.state.values.goal_name.name.value;

        const user = await prisma.user.findFirstOrThrow({
            where: {
                slackUser: {
                    slackId: slackId
                }
            },
            include: {
                goals: {
                    where: {
                        completed: false
                    }
                }
            }
        });

        if (!goalName) {
            await client.views.update({
                view_id: body.view.root_view_id!,
                view: await Goals.main(sessionId, 'Please enter a goal name')
            });            

            // updating views is broken
 
            return;
        }

        // Check if goal already exists
        if (user.goals.find(goal => goal.name === goalName)) {
            // await client.views.push({
            //     trigger_id: trigger_id,
            //     view: await Goals.create(sessionId, 'Goal with this name already exists')
            // });

            await client.views.update({
                view_id: body.view.root_view_id!,
                view: await Goals.main(sessionId, 'Goal with this name already exists')
            });

            return;
        }

        // Check if the max number of goals has been reached
        if (user.goals.length > 9) {
            // User should not have been able to get here
            await client.views.update({
                view_id: body.view.root_view_id!,
                view: await Goals.main(sessionId, 'You have reached the maximum number of goals')
            });

            return;
        }

        const newGoal = await prisma.goal.create({
            data: {
                id: uid(),

                name: goalName,

                user: {
                    connect: {
                        id: user.id
                    }
                },

                metadata: {}
            }
        });

        // Update root view with new goal
        await client.views.update({
            view_id: body.view.root_view_id!,
            view: await Goals.main(sessionId)
        });
    } catch (error) {
        emitter.emit('error', {error});
    }
});

Slack.action(Actions.DELETE_GOAL, async ({ body, client }) => {
    try {
        const sessionId = (body as any).view.private_metadata;

        const trigger_id: string = (body as any).trigger_id;

        const session = await prisma.session.findUniqueOrThrow({
            where: {
                id: sessionId
            },
            include: {
                goal: true
            }
        });

        if (!session.goal) {
            throw new Error(`Goal not found`);
        }

        // Ensure that it is not "No Goal"
        if (session.goal.name === 'No Goal') {
            await Slack.views.update({
                view_id: (body as any).view.root_view_id!,
                view: await Goals.main(sessionId, 'You cannot delete "No Goal"')
            });

            return;
        }

        await Slack.views.push({
            trigger_id: trigger_id,
            view: await Goals.delete(sessionId)
        });
    } catch (error) {
        emitter.emit('error', {error});
    }
});

Slack.view(Callbacks.DELETE_GOAL, async ({ body, view, client }) => {
    try {
        const sessionId = body.view.private_metadata;

        let session = await prisma.session.findUniqueOrThrow({
            where: {
                id: sessionId
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

        // if the goal is the default goal, prevent it from being deleted
        if (oldGoal.default) {
            await client.views.update({
                view_id: body.view.root_view_id!,
                view: await Goals.main(sessionId, 'You cannot delete "No Goal"')
            });

            return;
        }

        // Update the session with "No Goal"
        const noGoal = await prisma.goal.findFirstOrThrow({
            where: {
                userId: session.userId,
                default: true
            }
        });

        session = await prisma.session.update({
            where: {
                id: sessionId
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
                    minutes: {
                        decrement: session.elapsed
                    }
                }
            });

            await prisma.goal.update({
                where: {
                    id: noGoal.id
                },
                data: {
                    minutes: {
                        increment: session.elapsed
                    }
                }
            });
        }        

        updateController(session);
        updateTopLevel(session);

        await client.views.update({
            view_id: body.view.root_view_id,
            view: await Goals.main(sessionId)
        });
    } catch (error) {
        emitter.emit('error', {error});
    }
});