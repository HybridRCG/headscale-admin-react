# HS React — Installation Guide

## Requirements

- Docker + Docker Compose
- Headscale v0.28+ running in Docker
- A reverse proxy (Traefik recommended, nginx/Caddy also work)

---

## Option A — Pre-built Image (Recommended)

No build required. Pull directly from GitHub Container Registry.

### 1. Create your environment file

```bash
cp .env.example .env
```

Edit `.env`:
```env
JWT_SECRET=        # Generate: openssl rand -base64 32
HEADSCALE_DOMAIN=  # e.g. headscale.yourdomain.com
HEADSCALE_URL=     # e.g. http://headscale:8080 (internal Docker URL)
```

### 2. Create the users mapping file

Create `/etc/headscale/users-mapping.json`:

```json
{
  "users": {
    "YourAdminUsername": {
      "email": "admin@yourdomain.com",
      "role": "super_admin",
      "manageable_domains": ["*"]
    }
  },
  "api_key_labels": {}
}
```

> **Important:** Usernames must match your Headscale usernames exactly (case-sensitive).

### 3. Run

```bash
docker compose up -d
```

That's it. Open `https://your-domain.com/admin`.

---

## Option B — Build from Source

If you want to customise the code:

### 1. Clone

```bash
git clone https://github.com/HybridRCG/headscale-admin-react.git
cd headscale-admin-react
```

### 2. Install and build

```bash
npm install
npm run build
```

### 3. Build Docker image

```bash
docker build -t hs-react:latest .
```

### 4. Update docker-compose.yml

Change `image: ghcr.io/hybridrcg/hs-react:latest` to `image: hs-react:latest` in `docker-compose.yml`.

### 5. Run

```bash
docker compose up -d
```

---

## First Login

1. Create a Headscale API key for your admin user:
   ```bash
   docker exec headscale /ko-app/headscale apikey create --expiration 90d
   ```
2. Open `https://your-domain.com/admin`
3. Enter your Headscale **username** and the **API key** you just created
4. You're in as `super_admin`

---

## Nginx / Caddy (no Traefik)

Remove the `labels:` section from `docker-compose.yml` and uncomment the `ports:` line, then proxy to port 3000.

**Nginx example:**
```nginx
location /admin {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

**Caddyfile example:**
```
your-domain.com {
    handle_path /admin* {
        reverse_proxy localhost:3000
    }
}
```

---

## Updating

```bash
docker compose pull
docker compose up -d
```

---

## Roles

| Role | Access |
|------|--------|
| `super_admin` | Full access — all users, nodes, DNS, settings, routes |
| `group_admin` | Own domain only — users/nodes/ACL for their `@domain.com` |
| `user` | Read-only — own profile and labelled API keys only |

See [README.md](README.md) for full role and permission documentation.

---

## Volumes Explained

| Volume | Purpose |
|--------|---------|
| `/var/run/docker.sock` | Allows hs-react to run `headscale` CLI commands (expire nodes, pre-auth keys, etc.) |
| `/etc/headscale` | Reads `config.yaml` for DNS settings; reads/writes `users-mapping.json` for roles |

> **Security note:** Mounting the Docker socket gives the container elevated access. Only deploy on trusted infrastructure.
