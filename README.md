# Headscale Admin — React Edition

A production-ready, role-based administration dashboard for [Headscale](https://github.com/juanfont/headscale) v0.28+, built with React, TypeScript, Zustand, and Express.

**Live at:** `https://hs.groblers.co.uk/admin`  
**GitHub:** https://github.com/HybridRCG/headscale-admin-react

---

## Features

- **Email-based login** — username + Headscale API key, no passwords stored
- **Role-based access control** — three roles defined in `users-mapping.json`
- **Domain-based filtering** — group admins only see their own domain's users, nodes, and ACL entries
- **Nodes management** — view, rename, move, expire, delete, deploy new nodes
- **Users management** — create, rename, delete users, manage API keys per user
- **ACL editor** — edit groups, policies, SSH rules, tag owners, view users per domain
- **DNS management** — view and edit Headscale DNS configuration (super_admin only)
- **Routes management** — approve/disapprove subnet routes (super_admin only)
- **Settings** — manage `users-mapping.json` directly from the UI (super_admin only)
- **API key management** — create, label, expire, delete API keys; group admins can create keys for their domain users
- **Auto-versioned deploys** — single `deploy.sh` command handles everything

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Zustand, React Router |
| Backend | Node.js, Express |
| Auth | JWT sessions, Headscale API key validation |
| Container | Docker, Alpine Linux |
| Reverse Proxy | Traefik (strips `/admin` prefix) |
| Config | `users-mapping.json` for roles and domain mapping |

---

## Role System

Roles are defined in `/etc/headscale/users-mapping.json` (inside the container, mapped from `/headscale/configs/headscale/users-mapping.json` on the host).

### Role: `super_admin`
- Full access to all pages and all users/nodes/routes
- Can manage DNS, Settings, Routes
- Can manage all API keys with labels
- Sees all users, nodes, routes regardless of domain

### Role: `group_admin`
- Assigned a `manageable_domains` array (e.g. `["@mvsolar.co.za"]`)
- Can only see users, nodes, and ACL entries matching their domain
- Can create API keys for users in their domain
- Cannot access DNS, Settings, or Routes pages

### Role: `user`
- Read-only access to their own profile
- Can see API keys labelled with their username
- Cannot create or delete anything

### `users-mapping.json` Structure

```json
{
  "users": {
    "Hybrid": {
      "email": "riaan@groblers.co.uk",
      "role": "super_admin",
      "manageable_domains": ["*"]
    },
    "Marius": {
      "email": "marius@mvsolar.co.za",
      "role": "group_admin",
      "manageable_domains": ["@mvsolar.co.za"]
    },
    "Rika": {
      "email": "rika@mvsolar.co.za",
      "role": "user",
      "manageable_domains": []
    }
  },
  "api_key_labels": {
    "hskey-api-abc123": "Marius Login Key"
  }
}
```

> **Note:** Headscale v0.28 does not support setting emails on users via the API. The `users-mapping.json` file is the source of truth for emails, roles, and domain assignments.

---

## Navigation Visibility by Role

| Page | super_admin | group_admin | user |
|------|:-----------:|:-----------:|:----:|
| Home | ✅ | ✅ (no Routes/DNS/Settings cards) | ✅ |
| Users | ✅ all | ✅ own domain only | ✅ own profile |
| Nodes | ✅ all | ✅ own domain only | ✅ own nodes |
| Routes | ✅ | ❌ hidden | ❌ hidden |
| ACL Editor | ✅ | ✅ own domain users | ❌ |
| DNS | ✅ | ❌ hidden | ❌ hidden |
| Settings | ✅ | ❌ hidden | ❌ hidden |

---

## API Key Workflow

### Super Admin
1. Expand any user → full API keys section with create/expire/delete/label
2. Add a label to identify which key belongs to whom (e.g. "Marius Login Key")
3. Labels persist in `users-mapping.json`

### Group Admin (e.g. Marius)
1. Expand a user in their domain → sees **➕ Create API Key for [user]** button
2. Key is created and shown once — copy and send securely to the user
3. Key is auto-labelled with the user's name
4. Cannot create keys for users outside their domain

### User (e.g. Rika)
1. Expands their own profile → sees API keys labelled with their name (read-only)
2. Shows prefix and expiry date only

---

## Infrastructure

| Component | Details |
|-----------|---------|
| VPS | RackNerd VPS — `204.152.218.223` |
| Domain | `hs.groblers.co.uk` |
| Path | `/admin/` |
| Container | `headscale-admin-react:vX.Y.Z` |
| Port | `3000` (internal), proxied by Traefik |
| Config file | `/headscale/configs/headscale/users-mapping.json` |
| Deploy script | `/headscale/deploy-headscale-admin.sh` |

---

## Local Development Setup

### Prerequisites
- Node.js 20+
- Git

### Clone and install
```bash
git clone https://github.com/HybridRCG/headscale-admin-react.git
cd headscale-admin-react
npm install
```

### Run locally
```bash
REACT_APP_API_URL=/admin/api PUBLIC_URL=/admin npm start
```

---

## Deployment

### One-command deploy (from Mac)
```bash
~/headscale-admin-react/deploy.sh
```

This script automatically:
1. Detects the current running version from the VPS
2. Auto-increments the patch version
3. Updates `src/constants/version.ts` with the new version
4. Builds the React app locally (`npm run build`)
5. Commits and pushes to GitHub
6. SSHs to the VPS, pulls latest, rebuilds, and deploys Docker container
7. Cleans up old Docker images

### Manual VPS deploy
```bash
cd /headscale/headscale-admin-react
git pull
npm run build
/headscale/deploy-headscale-admin.sh <current_version> <next_version>
```

### Requirements for deploy script
- SSH key auth set up for `hybrid@hs.groblers.co.uk`
- `hybrid` user has passwordless sudo
- GitHub push access (personal access token configured)

---

## Docker

The Docker image packages:
- Pre-built React app (`build/` folder)
- Express backend (`server.js`)
- Node.js 20 Alpine base

```dockerfile
# Build locally first
npm run build

# Build image
docker build -t headscale-admin-react:vX.Y.Z .

# Run
docker compose up -d headscale-admin
```

---

## Authentication Flow

1. User enters **username** and **Headscale API key** on login page
2. Server validates the API key against Headscale (`GET /api/v1/user`)
3. Server looks up the username in `users-mapping.json` to get email, role, and `manageable_domains`
4. JWT session token is issued (24h expiry) containing email, username, role, and manageable_domains
5. On each page load, `/auth/me` refreshes role and domains from the mapping file (so changes take effect without re-login)
6. Logout clears the session

---

## Project Structure

```
headscale-admin-react/
├── src/
│   ├── components/
│   │   ├── Navigation.tsx       # Role-aware navigation
│   │   └── Footer.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── HomePage.tsx         # Dashboard cards
│   │   ├── NodesPage.tsx        # Node management + domain filter
│   │   ├── UsersPage.tsx        # User management + API key management
│   │   ├── RoutesPage.tsx       # Route approval (super_admin only)
│   │   ├── ACLPage.tsx          # ACL editor with domain filtering
│   │   ├── DNSPage.tsx          # DNS config (super_admin only)
│   │   └── SettingsPage.tsx     # users-mapping.json editor
│   ├── store/
│   │   ├── authStore.ts         # JWT session management
│   │   └── headscaleStore.ts    # Headscale API state
│   └── constants/
│       └── version.ts           # Auto-updated by deploy.sh
├── server.js                    # Express backend + API proxy
├── deploy.sh                    # One-command deploy script
├── Dockerfile
└── docker-compose.yml           # Part of /headscale/docker-compose.yml
```

---

## Changelog Highlights

| Version | Changes |
|---------|---------|
| v0.7.44 | Group admin API key creation for domain users |
| v0.7.43 | Role-aware API key visibility |
| v0.7.40 | API key labels stored in users-mapping.json |
| v0.7.36 | Auto-versioning in deploy.sh |
| v0.7.26 | Domain filtering for Nodes, Users, Routes |
| v0.7.22 | SSH-based deploy pipeline, local build workflow |
| v0.7.17 | Navigation role guards (DNS/Settings/Routes hidden) |
| v0.7.8  | Admin-only route guards |
| v0.1    | Initial MVP |

---

## Author

**Riaan Grobler** — [riaan@groblers.co.uk](mailto:riaan@groblers.co.uk)  
GitHub: [@HybridRCG](https://github.com/HybridRCG)

Built for the Headscale community with ❤️

---

## License

MIT License
