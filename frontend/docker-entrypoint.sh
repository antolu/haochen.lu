#!/bin/sh

# Set default backend URL if not provided
if [ -z "$BACKEND_URL" ]; then
    echo "BACKEND_URL not set, using default: http://backend:8000"
    export BACKEND_URL="http://backend:8000"
fi

echo "Configuring nginx to use backend: $BACKEND_URL"

# Replace the template variable with the actual backend URL
envsubst "${BACKEND_URL}" < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/conf.d/default.conf

# Remove the template file
rm /etc/nginx/conf.d/nginx.conf.template

# Start nginx
nginx -g "daemon off;"
