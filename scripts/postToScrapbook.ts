// const url = "https://hack-hour.manitej.hackclub.app/scrapbook/post";
const url = "https://optimum-stork-daily.ngrok-free.app/scrapbook/post";

fetch(url, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        user: {
            slackID: "U04QD71QWS0"
        },
        //https://hackclub.slack.com/archives/C063RPGKRL2/p1719441860816999
        postTime: "1719441860.816999",
        channel: "C063RPGKRL2",
        attachments: [
            "https://files.slack.com/files-tmb/T0266FRGM-F07AAJA143T-9a4090c4d0/image_720.png"
        ],
        messageText: "somethinaaaaaaag radical"
    }),
})
.then((data) => {
    console.log("Success:", data);
})
.catch((error) => {
    console.error("Error:", error);
});