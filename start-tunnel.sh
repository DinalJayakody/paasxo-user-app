#!/bin/bash
# Start Cloudflare tunnel → capture URL → update endpoints.ts → rebuild → redeploy
# Usage: bash start-tunnel.sh
set -e

ENDPOINTS_FILE="src/api/endpoints.ts"
LOG=/tmp/cf_tunnel.log

# Kill any existing tunnel
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1

echo "▶ Starting Cloudflare tunnel on port 8080..."
cloudflared tunnel --url http://localhost:8080 --logfile "$LOG" 2>/dev/null &
echo $! > /tmp/cf_tunnel.pid

# Wait for URL
TUNNEL_URL=""
for i in $(seq 1 20); do
  sleep 1
  TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1)
  [ -n "$TUNNEL_URL" ] && break
done

if [ -z "$TUNNEL_URL" ]; then
  echo "✖ Failed to get tunnel URL. Is cloudflared installed? (brew install cloudflare/cloudflare/cloudflared)"
  exit 1
fi

echo "✅ Tunnel: $TUNNEL_URL"

# Patch endpoints.ts with the new URL
sed -i '' "s|const TUNNEL_URL = '.*'|const TUNNEL_URL = '${TUNNEL_URL}/api'|" "$ENDPOINTS_FILE"
echo "✅ Updated $ENDPOINTS_FILE with tunnel URL"

echo "▶ Rebuilding web bundle..."
npx expo export --platform web

echo "▶ Writing Vercel config into dist/..."
mkdir -p dist/.vercel
cp .vercel/project.json dist/.vercel/project.json
cat > dist/vercel.json << 'EOF'
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [{"source":"/_expo/static/(.*)","headers":[{"key":"Cache-Control","value":"public, max-age=31536000, immutable"}]}]
}
EOF

echo "▶ Deploying to Vercel..."
./node_modules/.bin/vercel dist --prod --yes

echo ""
echo "✅ All done!"
echo "   Tunnel:     $TUNNEL_URL"
echo "   Web app:    https://paasxo-sports.vercel.app"
echo ""
echo "   Tunnel is running in background (PID $(cat /tmp/cf_tunnel.pid))."
echo "   Stop tunnel: bash stop-tunnel.sh"
