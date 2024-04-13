// This is the main file for the powerhour event.
        
import { PrismaClient, Prisma } from "@prisma/client";
import { App } from "@slack/bolt";
import { StringIndexed } from "@slack/bolt/dist/types/helpers.js";
import { BaseEvent, Session } from "./baseEvent.js";

const POWERHOUR_ORGANIZERS_CHANNEL = "C06TYNZ3DK8";

export const POWERHOUR_ID = "powerhour";

export class PowerHour implements BaseEvent {
    app: App<StringIndexed>;
    prisma: PrismaClient;

    name = "*TEACH Initative 2025*";
    description = "_We're just kidding - this is the beta test for the upcoming hack hour event._";
    id = POWERHOUR_ID;

    constructor(app: App, prisma: PrismaClient) {
        this.app = app;
        this.prisma = prisma;

        app.client.chat.postMessage({
            channel: POWERHOUR_ORGANIZERS_CHANNEL,
            text: "PowerHour Event Initialized",
        });
    }

    async endSession(session: Session): Promise<void> {

    }

    async cancelSession(session: Session): Promise<void> {

    }

    async hourlyCheck(): Promise<void> {
    }

    async userJoin(userId: string): Promise<void> {
        // Build the user         
    }
}