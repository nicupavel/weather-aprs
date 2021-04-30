#!/bin/sh
HAS_COMPOSE=$(docker-compose > /dev/null 2>&1)
if [ $? -ne 0 ]; then
    sudo curl -L https://github.com/docker/compose/releases/download/1.29.0/docker-compose-`uname -s`-`uname -m` -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

docker-compose up -d

