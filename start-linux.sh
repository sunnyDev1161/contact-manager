#!/bin/bash
cd "$(dirname "$0")"

fail() {
  echo ""
  echo "$1"
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed. Install it from https://nodejs.org (choose the LTS version), then run this script again."
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
xdg-open http://localhost:4000 2>/dev/null || echo "Open http://localhost:4000 in your browser."

echo ""
echo "Your POS is running at http://localhost:4000"
echo "Press Ctrl+C to stop it."
wait "$SERVER_PID"
