import { app, prisma } from '../app.js';
import { Actions, Callbacks } from '../views/picnics.js';
import { Views as HackViews } from '../views/hackhour.js';

import { Picnics } from './events/picnics.js';

app.action(Actions.SELECT, async ({ ack, body, client }) => {
    ack();
});

app.view(Callbacks.PICNIC, async ({ ack, body, client }) => {
    const slackId = body.user.id;
    const selectedPicnicId = body.view.state.values.picnic.selectPicnic.selected_option?.value;

    if (body.view.root_view_id == undefined) {
        return;
    }

    const selectedPicnic = Picnics.find((picnic) => picnic.ID === selectedPicnicId);

    const signup = await selectedPicnic?.userJoin(slackId);

    if (!signup) {
        await ack({
            response_action: 'errors',
            errors: {
                picnic: 'There was an error signing up for the picnic. The picnic may have not started yet or there was an error fetching picnic data.'
            }
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
});  