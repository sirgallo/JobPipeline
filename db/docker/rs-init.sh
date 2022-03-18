#!/bin/bash

mongosh <<EOF
var config = {
    "_id": "dev_replication_set",
    "version": 1,
    "members": [
        {
            "_id": 1,
            "host": "dev_primary:27018",
            "priority": 3
        },
        {
            "_id": 2,
            "host": "dev_replica1:27019",
            "priority": 1
        },
        {
            "_id": 3,
            "host": "dev_replica2:27020",
            "priority": 1
        }
    ]
};
rs.initiate(config, { force: true });
rs.status();
EOF