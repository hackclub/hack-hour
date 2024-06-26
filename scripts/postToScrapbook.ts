const url = "https://hack-hour.manitej.hackclub.app/scrapbook/post";

// {
//     "messageText": "wait wait",
//     "postTime": "1718625301.339709",
//     "attachments": [
//         "https://scrapbook-into-the-redwoods.s3.amazonaws.com/b4c10aee-e734-4b7c-ba9e-c384a177b682-img_3780.jpg"
//     ],
//     "user": {
//         "slackID": "U04QD71QWS0",
//         "name": "manitej"
//     },
//     "channel": "C063RPGKRL2"
// }


fetch(url, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        user: {
            slackID: "U04QD71QWS0"
        },
        //https://hackclub.slack.com/archives/C063RPGKRL2/p1719436984348359
        postTime: "1719436984.348359",
        channel: "C063RPGKRL2",
        attachments: [
            "https://files.slack.com/files-tmb/T0266FRGM-F07AAJA143T-9a4090c4d0/image_720.png"
        ],
        messageText: "something radical"
    }),
})
.then((data) => {
    console.log("Success:", data);
})
.catch((error) => {
    console.error("Error:", error);
});