# HS React — Installation Guide

## Requirements

- Docker + Docker Compose
- Headscale v0.28+ running in Docker
- A reverse proxy (Traefik recommended, nginx/Caddy also work)

---

## Install — Docker Only

No Node.js, no cloning, no building required.

### 1. Download the files

```bash
curl -O https://raw.githubusercontent.com/HybridRCG/headscale-admin-react/main/resources/docker-compose.yml
curl -O https://raw.githubusercontent.com/HybridRCG/headscale-admin-react/main/resources/env.example
cp env.example .env
```

### 2. Edit `.env`

```env
JWT_SECRET=        # Generate with: openssl rand -base64 32
HEADSCALE_DOMAIN=  # e.g. headscale.yourdomain.com
HEADSCALE_URL=     # e.g. http://headscale:8080
```

### 3. Start

```bash
docker compose up -d
```

> **`users-mapping.json` is created automatically** on first start at `/etc/headscale/users-mapping.json` with a default `admin` user.
> Edit it to match your actual Headscale username and email, then restart:
> ```bash
> docker compose restart hs-react
> ```

### 4. First login

Create a Headscale API key:
```bash
docker exec headscale /ko-app/headscale apikey create --expiration 90d
```

Open `https://your-domain.com/admin` — log in with your Headscale **username** and the **API key**.

---

## Updating

```bash
docker compose pull && docker compose up -d
```

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

## Volumes Explained

| Volume | Purpose |
|--------|---------|
| `/var/run/docker.sock` | Runs `headscale` CLI commands (expire nodes, pre-auth keys) |
| `/etc/headscale` | Auto-creates `users-mapping.json`; reads `config.yaml` for DNS |

> **Security note:** Mounting the Docker socket gives elevated access. Only deploy on trusted infrastructure.

---

## Roles

| Role | Access |
|------|--------|
| `super_admin` | Full access — all users, nodes, DNS, settings, routes |
| `group_admin` | Own domain only — users/nodes/ACL for their `@domain.com` |
| `user` | Read-only — own profile and labelled API keys only |

See [README.md](README.md) for full role documentation.

---

## users-mapping.json structure

After first start, edit `/etc/headscale/users-mapping.json`:

```json
{
  "users": {
    "YourHeadscaleUsername": {
      "email": "you@yourdomain.com",
      "role": "super_admin",
      "manageable_domains": ["*"]
    },
    "GroupAdminUser": {
      "email": "admin@company.com",
      "role": "group_admin",
      "manageable_domains": ["@company.com"]
    }
  },
  "api_key_labels": {}
}
```

> Usernames must match your Headscale usernames exactly (case-sensitive).
