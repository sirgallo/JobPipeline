#!/bin/bash
set -e

mongosh <<EOF
use devModels

db.createUser({
  user: 'devModelsUser',
  pwd: 'devModelsTestPass',
  roles: [
    {
      role: 'readWrite',
      db: 'devModels'
    }
  ],
});


db.createCollection('user', { capped: false });
db.createCollection('queryJob', { capped: false });
db.createCollection('token', { capped: false });
db.createCollection('org', { capped: false });

use devSystems

db.createCollection('system', { capped: false });
db.createCollection('authToken', { capped: false })

db.createUser({
  user: 'devSystemsDevUser',
  pwd: 'devSystemsTestPass',
  roles: [
    {
      role: 'readWrite',
      db: 'devSystems'
    }
  ],
});

EOF

mongosh --host 127.0.0.1:27018 -u devModelsUser -p devModelsTestPass devModels