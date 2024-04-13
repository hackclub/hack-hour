import { PrismaClient } from "@prisma/client";
import { App } from "@slack/bolt";
import { POWERHOUR_ID, PowerHour } from "./powerhour.js";
import { BaseEvent, Session } from "./baseEvent.js";

export const genEvents = (app: App, prisma: PrismaClient): { [keys: string]: BaseEvent } => {
    return {
        [POWERHOUR_ID]: new PowerHour(app, prisma)
    };
};