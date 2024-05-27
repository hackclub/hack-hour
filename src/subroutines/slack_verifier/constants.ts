import { app } from "../../lib/bolt.js"
import { emitter } from "../../lib/emitter.js"

export const Constants = {
    VERIFIER_CHANNEL: 'C06TYNZ3DK8',
    VERIFIERS: (await app.client.conversations.members({
        channel: 'C06TYNZ3DK8'
    })).members,
}

if (!Constants.VERIFIERS) {
    emitter.emit('error', 'Failed to fetch verifier members!')
}