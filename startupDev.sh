#!/bin/bash

readonly truthyInput="input should be yes or no"

echo "Init services? (yes or no):"
read startServices
#echo "Replicate mongo? (yes or no):"
#read replicateMongo
replicateMongo="no"

if [ "$startServices" == "yes" ]
then
  echo "starting services for the first time"
  if [ "$replicateMongo" == "yes" ]
  then
    docker-compose -f docker-compose.mongoreplica.yml up --build -d
    
    sleep 10

    docker exec -it devdb_primary_cont /usr/scripts/mongo-init.sh
    docker exec -it devdb_primary_cont screen -S initMongo kill
    docker exec -it devdb_primary_cont /usr/bin/mongod -f /usr/configs/mongod.primary.conf --bind_ip_all --replSet dev_replication_set --auth

    docker exec -it devdb_replica1_cont screen -S initMongo kill
    docker exec -it devdb_replica1_cont /usr/bin/mongod -f /usr/configs/mongod.replica1.conf --bind_ip_all --replSet dev_replication_set --auth

    docker exec -it devdb_replica2_cont screen -S initMongo kill
    docker exec -it devdb_replica2_cont /usr/bin/mongod -f /usr/configs/mongod.replica2.conf --bind_ip_all --replSet dev_replication_set --auth


  elif [ "$replicateMongo" == "no" ]
  then
    docker-compose -f docker-compose.mongosingle.yml up --build -d

    sleep 10

    docker exec -it devdb_primary_cont /usr/scripts/mongo-init.sh
    docker exec -it devdb_primary_cont screen -S initMongo kill
    docker exec -it devdb_primary_cont /usr/bin/mongod -f /usr/configs/mongo.single.conf --auth
  else
    echo truthyInput
  fi

  sleep 10

  docker-compose -f docker-compose.dev.yml up --build --scale gateway=2 --scale query=3
elif [ "$startServices" == "no" ]
then
  echo "restarting services..."
  if [ "$replicateMongo" == "yes" ]
  then
    docker-compose -f docker-compose.mongoreplica.yml up -d
  elif [ "$replicateMongo" == "no" ]
  then
    docker-compose -f docker-compose.mongosingle.yml up -d

  else
    echo truthyInput
  fi

  sleep 10

  docker-compose -f docker-compose.dev.yml up --build --scale gateway=2 --scale query=3
else
  echo truthyInput
fi