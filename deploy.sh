#!/bin/bash
set -e

# ── Colors ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

VPS="root@hs.groblers.co.uk"
PROJECT_DIR="/headscale/headscale-admin-react"
COMPOSE_DIR="/headscale"

print_step() { echo -e "${YELLOW}▶ $1${NC}"; }
print_ok()   { echo -e "${GREEN}✅ $1${NC}"; }
print_err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }
print_head() { echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ── Get version bump ─────────────────────────────────────────────────────────
CURRENT=$(ssh $VPS "docker ps --format '{{.Image}}' | grep headscale-admin-react | head -1 | grep -oP 'v\K[\d.]+'" 2>/dev/null || echo "")
if [ -z "$CURRENT" ]; then
  CURRENT=$(ssh $VPS "cd $PROJECT_DIR && git describe --tags --abbrev=0 2>/dev/null | tr -d 'v'" || echo "0.7.21")
fi

# Auto-increment patch version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
NEXT="${MAJOR}.${MINOR}.$((PATCH + 1))"

print_head "🚀 headscale-admin-react  v${CURRENT} → v${NEXT}"

# ── Step 1: Build React app locally ─────────────────────────────────────────
print_step "Step 1: Building React app..."
cd /Users/riaangrobler/headscale-admin-react
npm run build > /tmp/npm-build.log 2>&1 || { cat /tmp/npm-build.log; print_err "npm build failed"; }
print_ok "React build complete"

# ── Step 2: Commit & push ────────────────────────────────────────────────────
print_step "Step 2: Committing and pushing to GitHub..."
git add -A
if git diff --cached --quiet; then
  print_ok "Nothing new to commit, pushing existing changes"
else
  git commit -m "deploy: v${NEXT}"
fi
git push
print_ok "Pushed to GitHub"

# ── Step 3: Pull on VPS and deploy ──────────────────────────────────────────
print_step "Step 3: Pulling on VPS and deploying..."
ssh $VPS "
  set -e
  cd $PROJECT_DIR
  git fetch origin
  git reset --hard origin/main
  npm install --silent
  npm run build
  /headscale/deploy-headscale-admin.sh ${CURRENT} ${NEXT}
"
print_ok "Deployed v${NEXT} to VPS"

print_head "✅ v${NEXT} LIVE at https://hs.groblers.co.uk/admin"
