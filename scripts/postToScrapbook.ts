const url = "https://hack-hour.manitej.hackclub.app/scrapbook/post";

fetch(url, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        user: {
            slackID: "U04QD71QWS0"
        },
        //https://hackclub.slack.com/archives/C063RPGKRL2/p1719433637321779
        postTime: "1719433637.321779",
        channel: "C063RPGKRL2",
        attachments: [
            "https://files.slack.com/files-tmb/T0266FRGM-F07AAJA143T-9a4090c4d0/image_720.png"
        ],
        messageText: "This is a test message"
    }),
})
.then((data) => {
    console.log("Success:", data);
})
.catch((error) => {
    console.error("Error:", error);
});