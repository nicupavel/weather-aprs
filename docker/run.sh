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

if ! docker compose version &>/dev/null && ! command -v docker-compose &>/dev/null; then
    while true; do
        read -p "Missing Docker Compose. Do you wish to download & install it (y/n)? " ans
        case $ans in
            [Yy]* )
                echo "Installing Docker Compose plugin..."
                sudo apt-get update && sudo apt-get install -y docker-compose-plugin
                break;;
            [Nn]* )
                echo "Installation cancelled."
                exit 1;;
            * )
                echo "Please answer y or n.";;
        esac
    done
fi

if docker compose version &>/dev/null; then
    export COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
    export COMPOSE_CMD="docker-compose"
else
    echo "Error: Docker Compose installation failed or was not found."
    exit 1
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
echo "Interface will be available to http://localhost:$PROXY_HTTP_PORT/"

$COMPOSE_CMD $docker_opts stop
$COMPOSE_CMD $docker_opts up "$@" -d

$COMPOSE_CMD $docker_opts logs -f



