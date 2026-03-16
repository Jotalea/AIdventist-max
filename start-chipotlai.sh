#!/bin/bash
echo ""
echo "🌯 Starting Chipotlai Max..."
echo "   Powered by Pepper (until Chipotle notices)"
echo ""

# Start the proxy in the background
if [ -d "chipotle-llm-provider" ]; then
  echo "🌶️  Firing up the burrito brain (chipotle-llm-provider)..."
  (cd chipotle-llm-provider && npm install --silent 2>/dev/null && npm run dev) &
  PROXY_PID=$!
  echo "   Proxy PID: $PROXY_PID"
  sleep 2
else
  echo "⚠️  chipotle-llm-provider not found."
  echo "   Run: git submodule update --init"
  echo "   Or start the proxy manually at http://localhost:3000"
fi

echo ""
echo "🧀 Extra guac = longer context window"
echo ""

# Start chipotlai
bun run --cwd packages/opencode --conditions=browser src/index.ts "$@"

# Cleanup proxy on exit
if [ -n "$PROXY_PID" ]; then
  kill $PROXY_PID 2>/dev/null
fi
