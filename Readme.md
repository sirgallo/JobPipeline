# Job Pipeline

## Design

``` 
        client
          |
          |
  external load balancer
        /    \
       /      \
    gateway  gateway ... ---> db
      \        / 
       \      /
  internal load balancer
        /  |  \
       /   |   \
  worker worker worker ...
```    

`gateway` acts as api gateway, handles auth
`workers` handle jobs

## Prod

It is advised to deploy without `docker`, but if necessary, deploy `docker-compose` file to multiple machines behind load balancer. Deploy `mongo` cluster as standalone. Machines are designed to be stateless.

## Job Lifecycle

`Not Started` -> `In Queue` -> `In Progress` -> `Finished`
    ?--> `Failed`

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
  docker-compose -f docker-compose.dev.yml up --build --scale devgateway=2 --scale devworker=3
```

## Data access providers in `core`

  - Mongo (with `mongoose`)
  - MariaDb (with `mysql2`)

## ZMQ Provider in `core`
```
 --> Check out MQProvider for run down of `ROUTER/DEALER` connections
```

## Remove from production
  - mongo layer

## Remove all Docker Containers and Volumes, Clean System

```bash
  chmod 700 ./stopandremovealldockercontainers.sh
  ./stopandremovealldockercontainers.sh
```