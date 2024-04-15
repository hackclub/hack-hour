import { POWERHOUR_ID, PowerHour } from "./powerhour.js";
export const genEvents = (app, prisma) => {
    return {
        [POWERHOUR_ID]: new PowerHour(app, prisma)
    };
};
