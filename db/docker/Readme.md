# Replicated Mongo Set in Docker

```
          Primary
            /  \
          /     \
        /        \
   replica      replica  
```

Can handle one failover

data is stored to separate drives

## Note

Next step is to take `docker` and migrate to `kubernetes`