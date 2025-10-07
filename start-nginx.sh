#!/bin/sh

# Set default values if not provided
export BACKEND_HOST=${BACKEND_HOST:-localhost}
export BACKEND_PORT=${BACKEND_PORT:-3004}
export API_BASE_PATH=${API_BASE_PATH:-}

echo "Starting nginx with backend: http://$BACKEND_HOST:$BACKEND_PORT"
echo "API_BASE_PATH: '${API_BASE_PATH}'"

# Substitute environment variables in nginx config
envsubst '${BACKEND_HOST} ${BACKEND_PORT} ${API_BASE_PATH}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g "daemon off;"
