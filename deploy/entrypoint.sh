#!/bin/sh
set -e
mkdir -p /certs
if [ ! -f /certs/server.crt ]; then
  openssl req -x509 -newkey rsa:2048 \
    -keyout /certs/server.key \
    -out /certs/server.crt \
    -days 3650 -nodes \
    -subj "/CN=zwish.local"
fi
exec nginx -g 'daemon off;'
