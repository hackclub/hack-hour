// This is the main file for the powerhour event.
        
import { PrismaClient, Prisma } from "@prisma/client";
import { App } from "@slack/bolt";
import { StringIndexed } from "@slack/bolt/dist/types/helpers.js";
import { BaseEvent, Session } from "./baseEvent.js";
import { Constants } from "../constants.js";

const POWERHOUR_ORGANIZERS_CHANNEL = "C06TYNZ3DK8";

export const POWERHOUR_ID = "powerhour";

const POWERHOUR_USERS = [
    "U04QD71QWS0"
];

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
        await this.app.client.chat.postMessage({
            channel: Constants.HACK_HOUR_CHANNEL,
            thread_ts: session.messageTs,
            text: "Congrats for finishing this PowerHour session! Put down some reflections from your session or share your current progress.",
        });
    }

    async cancelSession(session: Session): Promise<void> {
        await this.app.client.chat.postMessage({
            channel: Constants.HACK_HOUR_CHANNEL,
            thread_ts: session.messageTs,
            text: "While this session was cancelled, you should still put down some reflections from your session or share your current progress.",
        });
    }

    async hourlyCheck(): Promise<void> {
        // Get current time in Chicago from UTC time
        const currentTime = new Date();
        currentTime.setHours(currentTime.getUTCHours() - 5);
        
    }

    async userJoin(userId: string): Promise<boolean> {
        // Check if the user is in allowed users
        if (POWERHOUR_USERS.includes(userId)) {
            return true;
        }
        return false;
    }
}