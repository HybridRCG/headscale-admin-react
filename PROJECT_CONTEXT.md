# HS React — Project Context

## Current State
- **Version:** v0.7.84 (live)
- **Live URL:** https://hs.groblers.co.uk/admin
- **GitHub:** https://github.com/HybridRCG/headscale-admin-react
- **Docker Image:** ghcr.io/hybridrcg/hs-react:latest (auto-built on push)
- **Deploy:** ~/headscale-private/deploy.sh
- **VPS:** hybrid@hs.groblers.co.uk
- **Local:** /Users/riaangrobler/headscale-admin-react
- **VPS compose:** /headscale/docker-compose.yml
- **VPS deploy script:** /headscale/deploy-headscale-admin.sh

## Architecture
- Frontend: React 18, TypeScript, Zustand, React Router
- Backend: Node.js Express (server.js) — proxies Headscale API, handles auth/JWT
- Auth: Username + Headscale API key → JWT 24h with role and manageable_domains
- Container: Docker Alpine, port 3000, behind Traefik at /admin/
- Config: /etc/headscale/users-mapping.json (auto-created on first start)

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
- GET /api/headscale/audit-log

## Headscale v0.28 Notes
- Pre-auth key API requires user as uint64 numeric ID (not username string)
- No node move API — delete + new pre-auth key only
- preauthkeys list has no --user flag — fetch all, deduplicate by ID client-side
- Expire: headscale preauthkeys expire --id <N>

## ACL Editor Tabs (6 — Tag Owners removed)
0:Users 1:Groups 2:Hosts 3:Policies 4:SSH 5:Config

## Security
- Rate limiting on login (express-rate-limit)
- Shell injection: nodeId/keyId validated numeric before execSync
- JWT_SECRET from environment variable
- Docker socket mount needed for CLI commands

## Completed Features (v0.7.84)
- Role-based access + domain filtering
- Deploy wizard with live command + pre-auth key generation
- Pre-Auth Keys — create/expire/clear expired
- Visual ACL policy builder with edit in-place
- Routes table, DNS sticky toolbar, dark theme throughout
- Buy Me a Coffee footer (buymeacoffee.com/hybridrcg)
- Version on login page bottom-right (links to GitHub)
- GitHub Actions → auto-builds ghcr.io/hybridrcg/hs-react:latest
- Docker-only install, users-mapping.json auto-created
- Home page 3x2 grid, stats bar (Users/Nodes Online/Offline)

## NEXT FEATURE: Registration/Licensing System
Goal: Client enters registration key in Settings → validates → hides Buy Me Coffee

### Chosen Approach: HMAC per-client keys (server-side validation)
- You generate unique HMAC key per client using your private secret
- Stored in users-mapping.json per user
- Registration persists tied to username
- Hides Buy Me Coffee if user.isRegistered === true
- Keys can embed client name, year, expiry

### Key Format
HS-{CLIENTNAME}-{YEAR}-{hmac_signature_8chars}
Example: HS-ACMECORP-2026-a3f9b2c1

### users-mapping.json addition
{
  "users": {
    "AdminUser": {
      "email": "...", "role": "super_admin",
      "manageable_domains": ["*"],
      "registration_key": "HS-ACMECORP-2026-a3f9b2c1",
      "registered_at": "2026-04-16T00:00:00Z"
    }
  }
}

### Implementation Plan
1. server.js — POST /api/headscale/register validates HMAC, saves to users-mapping.json
2. server.js — GET /api/auth/me returns isRegistered in response
3. SettingsPage — new Registration section with key input + Register button
4. Footer — hide Buy Me Coffee if user.isRegistered === true
5. Private key generator script (NOT in repo) — generates HMAC keys per client
6. authStore.ts — add isRegistered to user state
