# Gateway

Authenticates all requests, adds jobs to internal mongo db, pushes jobs to worker machine

## routes

`/gateway/register`
*POST*
```json
{
  "firstName": "any",
  "lastName": "any",
  "email": "any@gmail.com",
  "password": "testPass",
  "organization": "test",
  "accessControlLevel": "Dev"
}
```

`/gateway/login`
*POST*
```json
{
  "email": "any@gmail.com",
  "password": "testPass"
}
```

`/gateway/addjob`
*POST*
```json
{
  "user": {
    "email": "any@gmail.com"
  },
  "query": {
    "query": "Just testing...",
    "organization": "test",
    "dbType": "MariaDb",
    "lifeCycle": "Not Started" | null
  },
  "origToken": "<token>"
}
```