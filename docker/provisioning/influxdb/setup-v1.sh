#!/bin/bash

set -e

echo "Apply influx init script v1"
influx auth create --org ${DOCKER_INFLUXDB_INIT_ORG} --all-access --json > /var/lib/influxdb2/auth.json
influx apply -f /docker-entrypoint-initdb.d/templates/aprs_v1.yml
