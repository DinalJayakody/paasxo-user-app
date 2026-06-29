#!/bin/bash
# Paasxo – one-command web redeploy
# Run: bash deploy-web.sh
set -e

echo "▶ Building web bundle..."
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

echo "✅ Done! Live at https://paasxo-sports.vercel.app"
