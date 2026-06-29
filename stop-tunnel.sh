#!/bin/bash
# Stop the Cloudflare tunnel started by start-tunnel.sh
pkill -f "cloudflared tunnel" 2>/dev/null && echo "✅ Tunnel stopped." || echo "No tunnel running."
rm -f /tmp/cf_tunnel.pid /tmp/cf_tunnel.log
