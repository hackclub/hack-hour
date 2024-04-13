/*
The events system attempts to future-proof any events I plan to do, instead of hacking together a finicky system directly into hack hour
*/

import { PrismaClient } from "@prisma/client";
import { App } from "@slack/bolt";

export abstract class BaseEvent {
    public app: App;
    public prisma: PrismaClient;

    constructor(app: App, prisma: PrismaClient) {
        this.app = app;
        this.prisma = prisma;
    }

    // Allow the event to process the user's session after completion
    async endSession(session: {
        messageTs: string,
        userId: string,
        template: string,
        goal: string, // Goal this session is for
        task: string, // Task that the person is working on currently
        time: number, // Total time for this session
        elapsed: number,    
        completed: boolean,
        attachment?: string,
        cancelled: boolean,
        createdAt?: string
    }) {}
        

}