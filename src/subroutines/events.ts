import { app, prisma, extensions } from "../app.js";

// Powerhour placeholder, I guess

extensions.attach({
    onStart: () => {
        console.log('Extension started');
    },
    onError: () => {
        console.log('Extension error');
    },
    userCreated: (slackId) => {
        console.log(`User created: ${slackId}`);
    },
    sessionStarted: (sessionTs) => {
        console.log(`Session started: ${sessionTs}`);
    },
    sessionCancelled: (sessionTs) => {
        console.log(`Session cancelled: ${sessionTs}`);
    },
    sessionCompleted: (sessionTs) => {
        console.log(`Session completed: ${sessionTs}`);
    },
    isPicnic: () => { return true; },
    registerPicnic: (slackId) => {
        return {
            accept: true,
            message: 'Picnic registered'
        }
    }
});