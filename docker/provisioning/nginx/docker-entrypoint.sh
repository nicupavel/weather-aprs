#!/usr/bin/env sh
set -eu

envsubst '${API_HTTP_PORT}' < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"