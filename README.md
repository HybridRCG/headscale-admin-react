<!-- Copyright (c) 2026 HybridRCG - See LICENSE for terms -->

# HS React

A production-ready, role-based administration dashboard for [Headscale](https://github.com/juanfont/headscale) v0.28+, built with React, TypeScript, Zustand, and Express.

> Originally forked from [headscale-admin](https://github.com/HybridRCG/headscale-admin) (Svelte). That project became unmaintained so this is a full React rewrite — now published independently as **HS React**.

**GitHub:** https://github.com/HybridRCG/headscale-admin-react

## ☕ Support Me

If you like this project, consider buying me a coffee!

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-yellow?logo=buy-me-a-coffee)](https://buymeacoffee.com/hybridrcg)

---

## Features

- **Login** — username + Headscale API key, JWT session (24h)
- **Role-based access** — `super_admin`, `group_admin`, `user` via `users-mapping.json`
- **Domain filtering** — group admins only see users/nodes/ACL for their domain(s)
- **Nodes** — view, search, filter, rename, change owner, expire, delete
- **Deploy wizard** — visual `tailscale up` command builder with live preview, flag toggles, pre-auth key generation
- **Users** — create, rename, delete, login key management with labels
- **Pre-Auth Keys** — create/expire per user, filter by status, user column shown
- **Routes** — table view with per-route approve/disapprove; nodes without routes excluded
- **ACL Editor** — 7-tab editor with sticky navbar-style tab bar:
  - **Users** — view/create/delete users, manage role & domain permissions table
  - **Groups** — create/edit/delete ACL groups with member management
  - **Tag Owners** — define which users can apply ACL tags to nodes
  - **Hosts** — hostname→IP mappings; node dropdown with 🟢/🔴 status + auto IP fill
  - **Policies** — visual policy builder: protocol buttons (Any/TCP/UDP/ICMP), source/destination type selectors (Custom/User/Host/Group), port fields, edit policies in-place
  - **SSH** — SSH access rules
  - **Config** — raw JSON editor with Check Syntax → Apply Config (disabled if invalid)
- **DNS** — sticky toolbar, compact dark form for tailnet name, Magic DNS, nameservers, split DNS, extra records
- **Settings** — pre-auth key management, audit log
- **Audit log** — all create/expire/delete actions logged with actor, action, target
- **Dark/light mode** toggle

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Zustand, React Router |
| Backend | Node.js, Express |
| Auth | JWT, Headscale API key validation |
| Container | Docker, Alpine Linux |
| Reverse Proxy | Traefik (strips `/admin` prefix) |
| Config | `users-mapping.json` for roles and domain mapping |

---

## Role System

Roles are defined in `/etc/headscale/users-mapping.json` inside the container.

### `super_admin`
Full access to all pages, users, nodes, routes, DNS, settings.

### `group_admin`
Assigned `manageable_domains` (e.g. `["@company.com"]`). Only sees/manages users, nodes, and ACL entries matching their domain. No DNS, Settings, or Routes access.

### `user`
Read-only. Sees own profile and API keys labelled with their name.

### `users-mapping.json` structure

```json
{
  "users": {
    "AdminUser": {
      "email": "admin@yourdomain.com",
      "role": "super_admin",
      "manageable_domains": ["*"]
    },
    "GroupAdminUser": {
      "email": "groupadmin@company-b.com",
      "role": "group_admin",
      "manageable_domains": ["@company-b.com"]
    },
    "ViewerUser": {
      "email": "viewer@company-b.com",
      "role": "user",
      "manageable_domains": []
    }
  },
  "api_key_labels": {
    "hskey-api-abc123": "GroupAdmin Login Key"
  }
}
```

> **Note:** Headscale v0.28 does not support setting emails via the API. `users-mapping.json` is the source of truth for emails, roles, and domain assignments.

---

## Navigation by Role

| Page | super_admin | group_admin | user |
|------|:-----------:|:-----------:|:----:|
| Home | ✅ | ✅ (limited) | ✅ |
| Users | ✅ all | ✅ own domain | ✅ own profile |
| Nodes | ✅ all | ✅ own domain | ✅ own nodes |
| Routes | ✅ | ❌ | ❌ |
| ACL Editor | ✅ | ✅ own domain | ❌ |
| DNS | ✅ | ❌ | ❌ |
| Settings | ✅ | ❌ | ❌ |

---

## Deploy Wizard

The **+ Deploy** button on the Nodes page opens a full wizard:

- **Sticky command bar** — live `tailscale up` command, always visible when scrolling
- **General** — Shields Up, Generate QR, Reset, Operator, Force Reauth, SSH Server
- **Pre-Auth Key** — user dropdown (role-filtered), expiry days, Reusable/Ephemeral toggles; generates key via server and injects `--auth-key=` into command automatically
- **Advertise** — Exit Node, Tags (chip input), Routes (chip input)
- **Accept** — Accept DNS, Accept Routes, Exit Node LAN

---

## Headscale v0.28 Notes

- Pre-auth key REST API requires `user` as a **uint64 numeric ID** — not a username string
- Keys are fetched once and deduplicated by ID client-side (v0.28 ignores `?user=` filter)
- Expire uses key ID via `headscale preauthkeys expire --id <N>` CLI
- No node move API — changing owner deletes the node and creates a new pre-auth key
- Pre-auth keys do **not** disconnect active nodes — only needed at initial registration

---

## Installation

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- Headscale v0.28+ in Docker
- Traefik or nginx reverse proxy

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

### Build and deploy
```bash
npm run build
docker build -t hs-react:v1.0.0 .
docker compose up -d hs-react
```

---

## Authentication Flow

1. User enters username + Headscale API key
2. Server validates key against Headscale `GET /api/v1/user`
3. Server looks up username in `users-mapping.json` → gets email, role, domains
4. JWT issued (24h) with role and domain claims
5. `/auth/me` refreshes role/domains on each page load (no re-login after permission changes)

---

## Project Structure

```
headscale-admin-react/
├── src/
│   ├── components/
│   │   ├── Navigation.tsx         # Role-aware nav
│   │   ├── DeployModal.tsx        # Deploy wizard
│   │   └── Footer.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── NodesPage.tsx
│   │   ├── UsersPage.tsx
│   │   ├── RoutesPage.tsx
│   │   ├── AclPage.tsx            # 7-tab ACL editor
│   │   ├── DnsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── PreAuthKeysPage.tsx
│   │   └── AuditLogPage.tsx
│   ├── store/
│   │   ├── authStore.ts
│   │   └── headscaleStore.ts
│   └── constants/
│       └── version.ts             # Auto-updated by deploy script
├── server.js                      # Express backend + API proxy + auth
├── Dockerfile
└── docker-compose.yml
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v0.7.69 | Renamed app to **HS React** throughout |
| v0.7.68 | ACL Policies visual builder: protocol/type buttons, src/dst type selectors (Custom/User/Host/Group), port fields, edit policies in-place, consistent button heights |
| v0.7.67 | ACL tabs sticky below navbar; Groups bold large names; Hosts node dropdown with 🟢/🔴 + auto IP; Config tab syntax validator; Manage Permissions clean table |
| v0.7.65 | Routes page table view (no-route nodes excluded); DNS sticky toolbar, compact dark theme |
| v0.7.63 | ACL tab bar matches main navbar style; h2 headings removed from tabs |
| v0.7.62 | Pre-auth key create fixed for Headscale v0.28 (uint64 user ID); default expiry 90 days |
| v0.7.60 | Pre-auth keys page rebuilt: per-user fetch, deduplication, user column, expire via key ID CLI |
| v0.7.58 | Deploy modal: sticky command header, single-row pre-auth controls, right-aligned generate |
| v0.7.55 | Deploy modal: full wizard with General/Pre-Auth/Advertise/Accept, live command, user dropdown |
| v0.7.53 | Nodes: Routes button disabled when no routes; move owner warning + pre-auth key shown |
| v0.7.50 | Pre-auth keys page: create form layout, expire endpoint via server |
| v0.7.44 | Group admin API key creation for domain users |
| v0.7.40 | API key labels stored in users-mapping.json |
| v0.7.36 | Auto-versioning in deploy script |
| v0.7.26 | Domain filtering for Nodes, Users, Routes |
| v0.7.17 | Navigation role guards (DNS/Settings/Routes hidden by role) |
| v0.1    | Initial React rewrite from Svelte fork |

---

## License

MIT License — see [LICENSE](LICENSE)
