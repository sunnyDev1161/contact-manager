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

cd desktop || fail "Could not find the desktop folder."
if [ ! -d "node_modules" ]; then
  echo "Installing the app shell, this only happens once (downloads ~150MB, needs internet)..."
  npm install || fail "Desktop app install failed, see the error above."
fi
cd ..

echo "Starting your POS..."
cd desktop
npm start
cd ..
