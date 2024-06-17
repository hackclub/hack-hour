import { app, Slack } from "../../../lib/bolt.js";
import { Environment } from "../../../lib/constants.js";

export async function log(message: string) {
    await Slack.slog(message);
}