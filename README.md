# Hack Hour (Arcade)
Hack Hour is a project tracker & time management tool for hacking on projects. It's currently being used to track hours as a part of [Hack Club's Arcade](https://hackclub.com/arcade) and is on slack as `@hakkuun` (but her name is heidi 😊).

![](https://api.checklyhq.com/v1/badges/checks/271a416b-7810-47b0-b58c-7cd9e9e37f82?style=flat&theme=default&responseTime=false)

## API
_Note: There is no guarantee for the reliability of the API. If data is lost and/or is not registered for Arcade, there's not much we can do - use at your own risk._

All endpoints require an authorization header with the api key, as such: `Authorization: Bearer <apikey>`

### GET `/api/session/:slackId`
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
        "completed": false,
        "messageTs": "messageTs",
    }
}
```

### GET `/api/stats/:slackId`
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

### GET `/api/goals/:slackId`
Gets the goals for the user.

Example Response:
```json
{
    "ok": true,
    "data": [
        {
            "id": "id",
            "name": "No Goal",
            "minutes": 0
        }
    ]
}
```

### GET `/api/history/:slackId`
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

### POST `/api/start/:slackId`
Starts a new session for the user.

Requires a JSON body with the following fields:
- `work`: what the user is working on (string)

Example Response:
```json
{
    "ok": true,
    "data": {
        "id": "sessionId",
        "slackId": "slackId",
        "createdAt": "createdAt",
    }
}
```

### POST `/api/pause/:slackId`
Pauses or resumes the current session for the user, depending on the current state.

Requires an authorization header with the api key, as such: `Authorization: Bearer <apikey>`

Example Response:
```json
{
    "ok": true,
    "data": {
        "id": "sessionId",
        "slackId": "slackId",
        "createdAt": "createdAt",
        "paused": true,
    }
}
```

### POST `/api/cancel/:slackId`
Cancels the current session for the user.

Requires an authorization header with the api key, as such: `Authorization Bearer <apikey>`

Example Response:
```json
{
    "ok": true,
    "data": {
        "id": "sessionId",
        "slackId": "slackId",
        "createdAt": "createdAt",
    }
}
```

### POST `/api/setGoal/:slackId` 
Set the goal for current session for the user 

Requires an authorization header with the api key, as such: `Authorization Bearer <apikey>` 

Example Response: 
```json
{ 
    "ok": true, 
    "data": { 
        "id": "sessionId", 
        "slackId": "slackId", 
        "createdAt": "createdAt", 
        "goal": "newGoal" 
    } 
} 
```

## API - No Auth

### GET `/ping`
Returns with `pong`. Check if the thing is alive

### GET `/status`
Get specific details on the status of hack hour (heidi)

Example Response:
```json
{
    "activeSessions": -1,
    "airtableConnected": false,
    "slackConnected": false,
}
```

### GET `/api/clock/:slackId`
Depreciated.

Responds with unix timestamp of the expected end time of the current session for the user.