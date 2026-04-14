#!/bin/bash
set -e

# ── Colors ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
print_step() { echo -e "${YELLOW}▶ $1${NC}"; }
print_ok()   { echo -e "${GREEN}✅ $1${NC}"; }
print_err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }
print_head() { echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n${BLUE}  $1${NC}\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

VPS="YOUR_VPS_USER@your-headscale-domain.com"
PROJECT_DIR="/your-path/headscale-admin-react"
LOCAL_DIR="$(git rev-parse --show-toplevel)"

# ── Get current version from running container ───────────────────────────────
CURRENT=$(ssh $VPS "docker ps --format '{{.Image}}' | grep headscale-admin-react | head -1 | grep -oP 'v\K[\d.]+'" 2>/dev/null || echo "")
if [ -z "$CURRENT" ]; then
  CURRENT=$(ssh $VPS "cd $PROJECT_DIR && git describe --tags --abbrev=0 2>/dev/null | tr -d 'v'" || echo "0.1.0")
fi
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
NEXT="${MAJOR}.${MINOR}.$((PATCH + 1))"

print_head "🚀 headscale-admin-react  v${CURRENT} → v${NEXT}"

cd $LOCAL_DIR

# ── Step 1: Update version.ts ────────────────────────────────────────────────
print_step "Step 1: Updating version to v${NEXT}..."
printf "export const APP_VERSION = '%s';\nexport const APP_NAME = 'Headscale Admin';\n" "$NEXT" > src/constants/version.ts
print_ok "version.ts updated"

# ── Step 2: Build React app ──────────────────────────────────────────────────
print_step "Step 2: Building React app..."
npm run build > /tmp/npm-build.log 2>&1 || { cat /tmp/npm-build.log; print_err "npm build failed"; }
print_ok "React build complete"

# ── Step 3: Commit & push ─────────────────────────────────────────────────────
print_step "Step 3: Committing and pushing to GitHub..."
git add -A
if git diff --cached --quiet; then
  print_ok "Nothing new to commit"
else
  git commit -m "deploy: v${NEXT}"
fi
git push
print_ok "Pushed to GitHub"

# ── Step 4: Pull & deploy on VPS ─────────────────────────────────────────────
print_step "Step 4: Deploying to VPS..."
ssh $VPS "
  set -e
  cd $PROJECT_DIR
  sudo git fetch origin
  sudo git reset --hard origin/main
  sudo npm install --silent
  sudo npm run build
  sudo /your-path/deploy-headscale-admin.sh ${CURRENT} ${NEXT}
"
print_ok "Deployed v${NEXT} to VPS"

print_head "✅ v${NEXT} LIVE at https://your-headscale-domain.com/admin"
