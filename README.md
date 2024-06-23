# Hack Hour (Arcade)
Hack Hour is a project tracker & time management tool for hacking on projects. It's currently being used to track hours as a part of [Hack Club's Arcade](https://hackclub.com/arcade) and is on slack as `@hakkuun` (but her name is heidi 😊).

![](https://api.checklyhq.com/v1/badges/checks/271a416b-7810-47b0-b58c-7cd9e9e37f82?style=flat&theme=default&responseTime=false)

## API

### `/ping`
Returns with `pong`. Check if the thing is alive

### `/status`
Get specific details on the status of hack hour (heidi)

Example Response:
```json
{
    "activeSessions": -1,
    "airtableConnected": false,
    "slackConnected": false,
}
```

### `/api/clock/:slackId`
Depreciated. Use `/api/session/:slackId` instead.

Responds with unix timestamp of the expected end time of the current session for the user.

### `/api/session/:slackId`
Gets the latest session for the user.

Example Response:
```json
{
    "ok": true,
    "data": {
        "id": "slackId",
        "createdAt": "2024-06-23T02:49:17.900Z",
        "time": 60,
        "elapsed": 12,
        "remaining": 48,
        "endTime": "2024-06-23T03:08:00.000Z",
        "goal": "No Goal",
        "paused": true,
        "completed": false
    }
}
```

### `/api/stats/:slackId`
Gets the stats for the user.

Example Response:
```json
{
    "ok": true,
    "data": {
        "sessions": 0,
        "total": 0,
    }
}
```

### `/api/goals/:slackId`
Gets the goals for the user.

Example Response:
```json
{
    "ok": true,
    "data": {
        "goals": [
            {
                "name": "No Goal",
                "minutes": 0,
            }
        ]
    }
}
```

### `/api/history/:slackId`
Gets the history for the user.

Example Response:
```json
{
    "ok": true,
    "data": [
        {
            "createdAt": "2024-06-23T05:09:04.105Z",
            "time": 60,
            "elapsed": 23,
            "goal": "No Goal",
            "ended": false,
            "work": "123"
        }
    ]
}
```