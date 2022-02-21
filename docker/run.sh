#!/bin/bash

# Load environment
if [ -a ../.env ]
then
    set -a
    echo -n "Loading environment "
    . ../.env
    echo " done"
    set +a
else
    echo "Missing .env file. Please create this file to be able to run this script."
    echo "Start from .env.sample file: cp .env.sample .env"
    exit 1
fi

if ! command -v docker-compose &>/dev/null
then
    while true; do
        read -p "Missing docker-compose. Do you wish to download & install it (y/n) ?" ans
        case $ans in
            [Yy]* ) sudo curl -L https://github.com/docker/compose/releases/download/v2.2.2/docker-compose-`uname -s`-`uname -m` -o /usr/local/bin/docker-compose
                    sudo chmod +x /usr/local/bin/docker-compose;
                break;;
            * ) exit;;
        esac
    done
fi

docker_opts=""
export DOCKERFILE_EXT=

if [ ${DEVELOP_LOCALLY} -eq 1 ]; then
    set -a
    export DOCKERFILE_EXT=.dev
    set +a
    echo "Adding local folders as volumes for development"
    docker_opts="-f docker-compose.yml -f docker-compose.dev.volumes.yml"
fi
echo "Interface will be availeble to http://localhost:$PROXY_HTTP_PORT/"

sudo -E docker-compose build "$@"
sudo -E docker-compose $docker_opts up
echo "Open browser and navigate to http://localhost:$PROXY_HTTP_PORT/"


