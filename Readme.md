# Job Pipeline

## Design

```
        nginx
          |
          |
        gateway -- db
          |
          |
      whatever you like?
```

`gateway` acts as api gateway, handles auth

## Requirements 
  - docker 
  - docker-compose

## Run Api Gateway with MongoDb backend (launches docker containers)

```bash
  chmod 700 ./startupDev.sh
  ./startupDev.sh
```

## Rebuild just api layer

```bash
  docker-compose -f docker-compose.baseServer.yml up --build
```

## Data access providers in `core`

  - Mongo (with `mongoose`)
  - MariaDb (with `mysql2`)

## Remove from production

  - mongo layer

## Clean up docker containers

```bash
docker stop $(docker ps -a -q)
docker rm  $(docker ps -a -q)
```

## Clean up docker on filesystem

```bash
docker system prune -a -f
```