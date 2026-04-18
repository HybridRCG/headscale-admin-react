# HS React — Project Context

## Current State
- **Version:** v1.0.0 (live)
- **Live URL:** https://hs.groblers.co.uk/admin
- **Website:** https://hs.groblers.co.uk/hsreact
- **Demo:** https://hs.groblers.co.uk/hsreact/demo
- **GitHub:** https://github.com/HybridRCG/headscale-admin-react
- **Docker Image:** ghcr.io/hybridrcg/hs-react:latest (auto-built on push)
- **Deploy:** ~/headscale-private/deploy.sh
- **VPS:** hybrid@hs.groblers.co.uk
- **VPS compose:** /headscale/docker-compose.yml
- **VPS deploy script:** /headscale/deploy-headscale-admin.sh
- **Local:** /Users/riaangrobler/headscale-admin-react
- **Website files:** /Users/riaangrobler/headscale-admin-react/hsreact-site/
- **VPS website:** /headscale/hsreact-site/ (served by nginx:alpine container)

## Architecture
- Frontend: React 18, TypeScript, Zustand, React Router
- Backend: Node.js Express (server.js) — proxies Headscale API, handles auth/JWT
- Auth: Username + Headscale API key → JWT 24h with role and manageable_domains
- Container: Docker Alpine, port 3000, behind Traefik at /admin/
- Config: /etc/headscale/users-mapping.json (auto-created on first start)
- Secrets: /headscale/.env (chmod 644) — JWT_SECRET, HEADSCALE_URL, HS_LICENSE_SECRET

## Key File Paths (Mac)
- Local source: /Users/riaangrobler/headscale-admin-react/
- Private deploy: /Users/riaangrobler/headscale-private/deploy.sh
- Key generator: /Users/riaangrobler/headscale-private/generate-license-key.js
- Private secrets: /Users/riaangrobler/headscale-private/.env.secrets
- Website: /Users/riaangrobler/headscale-admin-react/hsreact-site/

## Key File Paths (VPS)
- Docker compose: /headscale/docker-compose.yml
- Env file: /headscale/.env (JWT_SECRET, HEADSCALE_URL, HS_LICENSE_SECRET)
- Deploy script: /headscale/deploy-headscale-admin.sh
- Users mapping: /headscale/configs/headscale/users-mapping.json
- Registration: /etc/headscale/registration.json
- Registered instances: /etc/headscale/registered-instances.json
- Audit log: /etc/headscale/audit-log.json
- Website: /headscale/hsreact-site/ (index.html + demo.html + nginx.conf)

## Roles
- super_admin — full access all pages
- group_admin — own domain only
- user — read-only own profile

## Key Server Endpoints
- POST /api/auth/login — validates API key, returns JWT (rate limited 20/15min)
- GET /api/auth/me — refreshes role/domains from mapping file
- POST /api/headscale/preauthkey/create — uses parseInt(user.id) for v0.28
- POST /api/headscale/preauthkey/expire — key ID via headscale CLI
- POST /api/headscale/node/move-user — delete node + new pre-auth key
- GET/POST /api/config/dns — reads/writes config.yaml
- GET/POST /api/headscale/user-emails — reads/writes users-mapping.json
- GET /api/headscale/audit-log — read audit log
- DELETE /api/headscale/audit-log — clear audit log
- GET /api/headscale/audit-log/export — download as CSV
- POST /api/headscale/register — validates HMAC license key
- GET /api/headscale/registration — returns {registered, payload}
- POST /api/headscale/unregister — clears registration.json
- GET /api/headscale/instances — list all registered instances (super_admin only)

## Headscale v0.28 Notes
- Pre-auth key API requires user as uint64 numeric ID
- No node move API — delete + new pre-auth key only
- preauthkeys list has no --user flag — fetch all, deduplicate by ID client-side
- last_seen returns protobuf object {seconds, nanos} not string
- online returns null (not false) for offline nodes

## ACL Editor Tabs (6 — Tag Owners removed)
0:Users 1:Groups 2:Hosts 3:Policies 4:SSH 5:Config

## Features Completed (v1.0.0)
- Role-based access + domain filtering throughout
- Deploy wizard — live tailscale up command, pre-auth key generation per user
- Pre-Auth Keys — create/expire/clear expired, auto-refresh on navigate
- Nodes — Routes modal, move owner modal with Copy Command/Copy Key/Done
- Routes table, DNS sticky toolbar, dark theme throughout
- ACL visual policy builder, edit in-place, Groups user dropdown
- Hosts tab — node dropdown with status + auto IP fill
- Config tab — JSON syntax validator
- Registration/licensing — HMAC keys, hides Buy Me a Coffee when registered
- Registered instances list in Settings (super_admin only)
- Unregister button in Settings
- Update checker in footer — amber button when GitHub has newer version
- Create user — role dropdown + add to login mapping in one step
- Buy Me a Coffee — yellow button in footer (hidden when registered)
- Version on login page bottom-right, links to GitHub
- GitHub Actions → auto-builds ghcr.io/hybridrcg/hs-react:latest
- Docker-only install, users-mapping.json auto-created on first start
- Home page 3x2 grid, stats bar (Users/Nodes Online/Offline)
- Security: rate limiting, shell injection validation
- Audit log — view, filter, search, clear, export CSV
- Mobile responsive — hamburger nav, scrollable tables, responsive footer
- Website at /hsreact with demo at /hsreact/demo

## Registration/Licensing System
- Key format: HSR-{CLIENTNAME}-{YEAR}-{12char HMAC}
- Generator: node ~/headscale-private/generate-license-key.js "ClientName"
- Secret must match VPS HS_LICENSE_SECRET and Mac .env.secrets
- Stored in /etc/headscale/registration.json
- Registered instances logged to /etc/headscale/registered-instances.json

## Deployment Pipeline
- ~/headscale-private/deploy.sh — bumps version, builds React, git push, SSH to VPS, docker build+deploy
- VPS deploy script uses docker rm -f pattern to avoid network conflict
- Container name: headscale-admin
- .env chmod 644 so docker can read without sudo

## Website & Demo
- Website: nginx:alpine container at /headscale/hsreact-site/
- nginx.conf routes /demo → demo.html, everything else → index.html
- Demo: fully simulated, fictional data, no backend, no risk to live instance
- Font: Plus Jakarta Sans (clean, modern, readable)

## Versioning
- Changed to v1.0.0 as of this session (was v0.7.x)
- Going forward: v1.0.0, v1.0.0 etc.
