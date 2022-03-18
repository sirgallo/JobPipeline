# Gateway

Authenticates all requests, adds jobs to internal mongo db, pushes job to worker machine

## routes

`/gateway/register`
*POST*
```json
{
  "firstName": "Nick",
  "lastName": "Gallo",
  "email": "nickgallo97@gmail.com",
  "password": "test",
  "organization": "visible",
  "accessControlLevel": "Dev"
}
```

`/gateway/login`
*POST*
```json
{
  "email": "nickgallo97@gmail.com",
  "password": "test"
}
```

`/gateway/addjob`
*POST*
```json
{
  "user": {
    "email": "nickgallo97@gmail.com"
  },
  "query": {
    "query": "Just testing...",
    "organization": "visible",
    "dbType": "MariaDb",
    "lifeCycle": "Not Started"
  },
  "origToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImJhNGVlNDEyLWI1NDktNDg0YS05YmFmLTA3MTFjYWU4YjQ5OSIsImlhdCI6MTY0NTQ1MzY4MSwiZXhwIjoxNjQ1NTQwMDgxfQ.eVooSgS0-cGtEzD6rfTrNb_GyGHC5l9QLZI2HdNPon0"
}
```