#!/usr/bin/env bash
# Kills orphaned Nx serve processes (api-event-webhook, consumer-events-ingest, scheduler-analytics, api-server-ingest, api-tenant-manager, api-analytics-bff)
# and frees their ports.

set -euo pipefail

PORTS=(3000 3002 3003 9229)
PATTERNS="consumer-events|api-event-webhook|scheduler-analytics|api-server-ingest|api-tenant-manager|api-analytics-bff"

killed=0

# Kill matching Nx fork processes
pids=$(ps aux | grep -E "$PATTERNS" | grep -v grep | awk '{print $2}' || true)
if [[ -n "$pids" ]]; then
  echo "$pids" | xargs kill 2>/dev/null || true
  killed=$(echo "$pids" | wc -l | tr -d ' ')
fi

# Kill anything still holding the ports
for port in "${PORTS[@]}"; do
  port_pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$port_pids" ]]; then
    echo "$port_pids" | xargs kill 2>/dev/null || true
    killed=$((killed + $(echo "$port_pids" | wc -l | tr -d ' ')))
  fi
done

if [[ $killed -gt 0 ]]; then
  echo "Killed $killed phantom process(es)."
else
  echo "No phantom processes found."
fi
