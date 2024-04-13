import { PrismaClient } from "@prisma/client";
import { App } from "@slack/bolt";
import { PowerHour } from "./powerhour.js";

export const events = (app: App, prisma: PrismaClient) => {
    return [
        new PowerHour(app, prisma)
    ];
};