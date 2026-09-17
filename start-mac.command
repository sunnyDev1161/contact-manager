#!/bin/bash
cd "$(dirname "$0")"

fail() {
  echo ""
  echo "$1"
  read -p "Press Enter to close..."
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed. Install it from https://nodejs.org (choose the LTS version), then double-click this file again."
fi

if [ ! -f "server/.env" ]; then
  echo "First-time setup..."
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  cat > server/.env <<EOF
DATABASE_URL="file:./dev.db"
JWT_SECRET="$JWT_SECRET"
PORT=4000
EOF
fi

cd server || fail "Could not find the server folder."
if [ ! -d "node_modules" ]; then
  echo "Installing backend, this only happens once..."
  npm install || fail "Backend install failed, see the error above."
fi
npx prisma migrate deploy || fail "Database setup failed, see the error above."
cd ..

cd client || fail "Could not find the client folder."
if [ ! -d "node_modules" ]; then
  echo "Installing frontend, this only happens once..."
  npm install || fail "Frontend install failed, see the error above."
fi
if [ ! -d "dist" ]; then
  echo "Building the app, this only happens once..."
  npm run build || fail "Build failed, see the error above."
fi
cd ..

echo "Starting your POS..."
cd server
npm start &
SERVER_PID=$!
cd ..

sleep 2
open http://localhost:4000

echo ""
echo "Your POS is running at http://localhost:4000"
echo "Close this window (or press Ctrl+C) to stop it."
wait "$SERVER_PID"
