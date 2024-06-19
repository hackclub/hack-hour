import { View } from "@slack/bolt";
import { Slack } from "../../../lib/bolt.js";
import { handleError } from "../../../lib/handleError.js";
import { Loading } from "../views/loading.js";

export async function openModal({triggerId, view}: {triggerId: string, view: View}) {
    try {
        let viewID;

        const loadingDelay = Slack.views.open({
            trigger_id: triggerId,
            view: Loading.loading()
        }).then(res => viewID = res?.view?.id);

        const minDelay = new Promise((resolve) => setTimeout(resolve, 3 * 1000)); // raccoons take their time to wake up!

        await Promise.all([loadingDelay, minDelay]);

        if (!viewID) {
            throw new Error("View ID not found");
        }

        Slack.views.update({
            view_id: viewID,
            view: Loading.loading()
        })
    } catch (error) {
        handleError(error)
    }
}