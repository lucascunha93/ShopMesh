#!/bin/sh
# Gera config.js com a URL do API Gateway informada ao container.
set -eu
cat > /usr/share/nginx/html/config.js <<CONFIG
window.SHOPMESH_API_URL = '${SHOPMESH_API_URL:-http://localhost:3000}';
CONFIG
