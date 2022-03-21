# Worker 

The worker machines operate over socket connections to the `gateway` machines. The only `http route` is `poll` for healthchecks on the machine. These machines are meant to operate as black boxes and have read only access to the database. Job updates are relayed back to the `gateway` machines.