import { Constants } from "../slack_verifier/constants.js"

export const Meta = {
    NAME: "*Power Hour*",
    DESCRIPTION: "every hour more power! Apr27-May4",
//    ID: POWERHOUR_ID,

    START_TIME: new Date("2024-05-27T00:00:00-0500"),
    END_TIME: new Date("2024-05-31T00:00:00-0500"),

    CUSTOM_NAME: "The Arcade",
    CUSTOM_EMOJI: ":arcade:",

    ADMINS: Constants.VERIFIERS,
    ADMIN_CHANNEL: Constants.VERIFIER_CHANNEL
}