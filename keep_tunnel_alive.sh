#!/bin/bash
while true; do
  echo "Starting Serveo tunnel..."
  ssh -o StrictHostKeyChecking=no -o ExitOnForwardFailure=yes -R barokahgrup-hris:80:127.0.0.1:5000 serveo.net || true
  echo "Serveo exited. Restarting in 5 seconds..."
  sleep 5
done
