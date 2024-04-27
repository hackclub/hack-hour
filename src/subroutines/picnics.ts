import { app, prisma, hourInterval } from '../app.js';
import { Actions, Callbacks, Views } from '../views/picnics.js';
import { Views as HackViews } from '../views/hackhour.js';

import { Picnics } from './events/picnics.js';

app.action(Actions.SELECT, async ({ ack, body, client }) => {
    ack();
});
/*
app.view(Callbacks.PICNIC, async ({ ack, body, client }) => {
    const slackId = body.user.id;
    const selectedPicnicId = body.view.state.values.picnic.selectPicnic.selected_option?.value;

    if (body.view.root_view_id == undefined) {
        return;
    }

    if (selectedPicnicId == 'none') {
        await prisma.user.update({
            where: {
                slackId: body.user.id
            },
            data: {
                eventId: selectedPicnicId
            }
        });
    
        await app.client.views.update({
            view_id: body.view.root_view_id,
            view: await HackViews.start(body.user.id)
        });
    
        await ack();

        return;
    }

    const selectedPicnic = Picnics.find((picnic) => picnic.ID === selectedPicnicId);

    if (selectedPicnic == undefined) {
        await ack({
            response_action: 'push',
            view: await Views.error("Invalid picnic selected")
        });

        return;
    }

    const { ok, message } = await selectedPicnic?.userJoin(slackId);

    if (!ok) {
        await ack({
            response_action: 'push',
            view: await Views.error(message)
        });

        return;
    }

    await prisma.user.update({
        where: {
            slackId: body.user.id
        },
        data: {
            eventId: selectedPicnicId
        }
    });

    await app.client.views.update({
        view_id: body.view.root_view_id,
        view: await HackViews.start(body.user.id)
    });

    await ack();
});*/
app.action(Callbacks.PICNIC, async ({ ack, body, client }) => {
    ack();
});

hourInterval.attach(() => {
    Picnics.forEach(async (picnic) => {
        await picnic.hourlyCheck();
    });
});