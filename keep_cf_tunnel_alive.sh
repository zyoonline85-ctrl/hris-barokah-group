#!/bin/bash
while true; do
  echo "Starting Cloudflare tunnel..."
  ./cloudflared tunnel --protocol http2 --url http://127.0.0.1:5000 > cf_tunnel.log 2>&1
  echo "Cloudflare tunnel exited. Restarting in 5 seconds..."
  sleep 5
done
