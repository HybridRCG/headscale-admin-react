<!-- Copyright (c) 2026 HybridRCG - See LICENSE for terms -->

# HS React

A production-ready, role-based administration dashboard for [Headscale](https://github.com/juanfont/headscale) v0.28+, built with React, TypeScript, Zustand, and Express.

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/hybridrcg)

## 📋 Changelog

### v1.0.24 — Latest
- ✅ **ACL History in Settings** — view, restore and delete ACL versions from Settings page
- ✅ **Access Check in Policies** — 🔍 Access Check button opens modal inside Policies tab
- ✅ **Friendly policy names** — add a name to any ACL rule, shown as yellow badge, persists correctly
- ✅ **Policy search** — filter policies by name, source or destination
- ✅ **Mobile ACL tabs** — tab bar wraps/shrinks on mobile, shows icons only on small screens
- ✅ **Save ACL 500 fix** — dst always uses `host:port` format, `users` field stripped
- ✅ **SSE live updates fix** — JWT passed as query param (EventSource can't send headers)
- ✅ **Node online/offline duration** — `⬆ 2h 14m` / `⬇ 8h 32m` per card from `lastSeen`
- ✅ **Node cards click-to-expand** — buttons hidden until card tapped
- ✅ **Network Topology** — canvas force graph, offline checkbox, drag/zoom/pan
- ✅ **ACL Access Check** — full group email resolution, host aliases, CIDR support

### v1.0.0 — First Stable Release
- Role-based access (super_admin, group_admin, user)
- Deploy wizard, Pre-Auth Keys, Nodes, Routes, ACL Editor (6 tabs), DNS
- Audit Log — view, filter, search, export CSV
- Registration/licensing system
- Update checker in footer

## Quick Start — Docker Only

No Node.js or build tools required. All install files are in the [`resources/`](resources/) folder.

### 1. Download the resources

```bash
curl -O https://raw.githubusercontent.com/HybridRCG/headscale-admin-react/main/resources/docker-compose.yml
curl -O https://raw.githubusercontent.com/HybridRCG/headscale-admin-react/main/resources/vps.env.example
cp vps.env.example .env
```

### 2. Configure environment

Edit `.env`:

```env
JWT_SECRET=        # Generate with: openssl rand -base64 32
HEADSCALE_DOMAIN=  # e.g. headscale.yourdomain.com
HEADSCALE_URL=     # e.g. http://headscale:8080
HS_LICENSE_SECRET= # Generate with: openssl rand -base64 32
```

### 3. Start

```bash
docker compose up -d
```

> **`users-mapping.json` is created automatically** on first start at `/etc/headscale/users-mapping.json` with a default `admin` user. Edit it to match your actual Headscale username and email, then restart: `docker compose restart hs-react`

### 4. First login

```bash
docker exec headscale /ko-app/headscale apikey create --expiration 90d
```

Open `https://your-domain.com/admin` — log in with your Headscale **username** and **API key**.

### 5. Updating

```bash
docker compose pull && docker compose up -d
```

---

## Features

- **Login** — username + Headscale API key, JWT session (24h)
- **Role-based access** — `super_admin`, `group_admin`, `user` via `users-mapping.json`
- **Domain filtering** — group admins only see users/nodes/ACL for their assigned domain(s)
- **Nodes** — view, search, filter, rename, change owner (with pre-auth key modal), expire, delete
- **Deploy wizard** — visual `tailscale up` command builder with live preview, pre-auth key generation per user
- **Users** — create (with role + login mapping in one step), rename, delete, login key management
- **Pre-Auth Keys** — create/expire per user, filter by status, auto-refresh on navigate, clear expired
- **Routes** — table view with per-route approve/disapprove; nodes without routes excluded
- **ACL Editor** — 6-tab editor with sticky navbar-style tab bar:
  - **Users** — view/create/delete, manage role & domain permissions table
  - **Groups** — create/edit/delete ACL groups with member management
  - **Hosts** — hostname→IP mappings with live node dropdown + auto IP fill + online status
  - **Policies** — visual builder: protocol (Any/TCP/UDP/ICMP), source/destination type selectors (Custom/User/Host/Group), port fields, edit in-place
  - **SSH** — SSH access rules
  - **Config** — raw JSON editor with syntax validation before save
- **DNS** — sticky toolbar, tailnet name, Magic DNS, nameservers, split DNS, extra records
- **Settings** — pre-auth keys, audit log, registration/licensing
- **Registration system** — license key validates instance, hides Buy Me a Coffee on registration
- **Update notifications** — footer shows amber button when a newer version is available on GitHub
- **Audit log** — all actions logged with actor, action, target
- **Dark/light mode** toggle

---

## Role System

Roles are defined in `/etc/headscale/users-mapping.json`.

| Role | Access |
|------|--------|
| `super_admin` | Full access — all users, nodes, DNS, settings, routes |
| `group_admin` | Own domain only — users/nodes/ACL for their `@domain.com` |
| `user` | Read-only — own profile and labelled API keys only |

### Page visibility

| Page | super_admin | group_admin | user |
|------|:-----------:|:-----------:|:----:|
| Home | ✅ | ✅ limited | ✅ |
| Users | ✅ all | ✅ own domain | ✅ own profile |
| Nodes | ✅ all | ✅ own domain | ✅ own nodes |
| Routes | ✅ | ❌ | ❌ |
| ACL Editor | ✅ | ✅ own domain | ❌ |
| DNS | ✅ | ❌ | ❌ |
| Settings | ✅ | ❌ | ❌ |

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
      "email": "groupadmin@company.com",
      "role": "group_admin",
      "manageable_domains": ["@company.com"]
    }
  },
  "api_key_labels": {}
}
```

> **Note:** Headscale v0.28 does not support setting emails via the API. This file is the source of truth.

---

## Registration / Licensing

HS React supports a simple per-instance licensing system:

1. Contact [HybridRCG](https://buymeacoffee.com/hybridrcg) to obtain a license key
2. Open **Settings → Registration** in your HS React instance
3. Click **Enter Key**, paste your key, click **Register**
4. The Buy Me a Coffee button disappears — your instance is licensed ✅

---

## Reverse Proxy

### Traefik (default)
Labels are pre-configured in `docker-compose.yml`. Set `HEADSCALE_DOMAIN` in `.env`.

### Nginx
Remove the `labels:` section, uncomment `ports: - "3000:3000"`, then:
```nginx
location /admin {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### Caddy
```
your-domain.com {
    handle_path /admin* {
        reverse_proxy localhost:3000
    }
}
```

---

## Volumes

| Volume | Purpose |
|--------|---------|
| `/var/run/docker.sock` | Runs `headscale` CLI commands (expire nodes, pre-auth keys) |
| `/etc/headscale` | Auto-creates `users-mapping.json`; reads `config.yaml` for DNS |

> **Security note:** Mounting the Docker socket gives elevated access. Only deploy on trusted infrastructure.

---

## Headscale v0.28 Notes

- Pre-auth key API requires `user` as **uint64 numeric ID**
- Expire uses key ID via `headscale preauthkeys expire --id <N>` CLI
- No node move API — changing owner deletes the node and issues a new pre-auth key
- Pre-auth keys do **not** disconnect active nodes

---

## Resources

All install files in [`resources/`](resources/):

| File | Purpose |
|------|---------|
| [`docker-compose.yml`](resources/docker-compose.yml) | Docker Compose service definition |
| [`vps.env.example`](resources/vps.env.example) | Environment variable template |
| [`users-mapping.json`](resources/users-mapping.json) | User roles config template |

---

## Changelog

| Version | Changes |
|---------|---------|
| v1.0.24 | Update checker in footer — amber button when newer version available on GitHub |
| v1.0.24 | Create user form — fixed heights, clear spacing between fields |
| v1.0.24 | Create user — role selector + add to login mapping checkbox in one step |
| v1.0.24 | Home page 3x2 grid; Users/Nodes cards name-only |
| v1.0.24 | Registration/licensing system — license key hides Buy Me a Coffee |
| v1.0.24 | Nodes move-owner modal with Copy Command/Copy Key; Pre-Auth Keys auto-refresh |
| v1.0.24 | Unregister button in Settings |
| v1.0.24 | Buy Me a Coffee in footer; version on login page links to GitHub |
| v1.0.24 | ACL Tag Owners tab removed; tab indices fixed |
| v1.0.24 | Pre-Auth Keys: Clear Expired button; Tag type removed from policy builder |
| v1.0.24 | Version number bottom-right of login card |
| v1.0.24 | Deploy modal sticky header; pre-auth key generation fixed for v0.28 |
| v1.0.24 | GitHub Actions auto-build to ghcr.io; Docker-only install; resources folder |
| v1.0.24 | Security: rate limiting, shell injection validation, dead code removed |
| v1.0.24 | Renamed to HS React throughout |
| v1.0.24 | ACL Policies visual builder with protocol/type buttons, edit in-place |
| v1.0.24 | ACL tabs sticky; Hosts node dropdown + auto IP; Config syntax validator |
| v1.0.24 | Routes page table; DNS sticky toolbar, compact dark theme |
| v1.0.24 | Domain filtering for Nodes, Users, Routes |
| v0.1 | Initial React rewrite from Svelte fork |

---

## License

MIT License — see [LICENSE](LICENSE)

---

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/hybridrcg)
