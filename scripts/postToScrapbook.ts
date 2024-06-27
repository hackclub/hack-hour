// const url = "https://hack-hour.manitej.hackclub.app/scrapbook/post";
const url = "https://optimum-stork-daily.ngrok-free.app/scrapbook/post";

fetch(url, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify(
        {
            "messageText": "wait wait",
            "postTime": "1718625301.339709",
            "attachments": [
                "https://scrapbook-into-the-redwoods.s3.amazonaws.com/b4c10aee-e734-4b7c-ba9e-c384a177b682-img_3780.jpg"
            ],
            "user": {
                "slackID": "U04QD71QWS0",
                "name": "manitej"
            },
            "channel": "C063RPGKRL2"
        }
    ),
})
.then((data) => {
    console.log("Success:", data);
})
.catch((error) => {
    console.error("Error:", error);
});