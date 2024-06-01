import { app } from "../../lib/bolt.js"
import { emitter } from "../../lib/emitter.js"

const members = (await app.client.conversations.members({
    channel: 'C06TYNZ3DK8'
}))

if (!members) {
    emitter.emit('error', 'Failed to fetch verifier members!')
    throw new Error('Failed to fetch verifier members!')
}

export const Constants = {
    VERIFIER_CHANNEL: 'C06TYNZ3DK8',
    VERIFIERS: members.members as string[],
}