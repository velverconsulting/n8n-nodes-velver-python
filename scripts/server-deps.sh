#!/bin/sh
# Instala DENTRO del contenedor n8n (Alpine/musl) las dependencias del custom
# node (las de package.json, incluido @napi-rs/canvas con su binario musl).
# El contenedor solo trae `npm` (no pnpm); es la única parte del repo que lo
# usa, y solo del lado servidor. El vendor es ESM y no resuelve por NODE_PATH,
# por eso van en node_modules junto al nodo.
# Uso (desde el host de n8n, después de copiar dist y package.json): sh scripts/server-deps.sh
set -e
docker exec -u node n8n sh -c '
  cd /home/node/.n8n/custom/n8n-nodes-velver &&
  npm install --omit=dev --no-audit --no-fund &&
  node -e "const {createCanvas}=require(\"@napi-rs/canvas\"); createCanvas(10,10); console.log(\"canvas OK\")"
'
