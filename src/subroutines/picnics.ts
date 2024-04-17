import { app, prisma } from '../app.js';

import { Callbacks } from '../views/picnics.js';

app.view(Callbacks.PICNIC, async ({ ack, body, client }) => {
    await ack();
});