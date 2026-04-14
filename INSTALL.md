# Installation Guide

## Requirements

- Docker + Docker Compose
- Headscale v0.28+
- Traefik reverse proxy (or any reverse proxy)

## Quick Start with Docker

### 1. Clone the repo

```bash
git clone https://github.com/HybridRCG/headscale-admin-react.git
cd headscale-admin-react
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

Generate a JWT secret:
```bash
openssl rand -base64 32
```

### 3. Create the users mapping file

Create `/etc/headscale/users-mapping.json` (or adjust the path in docker-compose):

```json
{
  "users": {
    "YourAdminUsername": {
      "email": "admin@yourdomain.com",
      "role": "super_admin",
      "manageable_domains": ["*"]
    },
    "GroupAdminUsername": {
      "email": "groupadmin@company.com",
      "role": "group_admin",
      "manageable_domains": ["@company.com"]
    },
    "ViewerUsername": {
      "email": "viewer@company.com",
      "role": "user",
      "manageable_domains": []
    }
  },
  "api_key_labels": {}
}
```

> **Important:** Headscale v0.28 does not support setting emails via API.
> This mapping file is the source of truth for roles and email addresses.
> Usernames must match exactly the headscale usernames.

### 4. Build and run

```bash
# Build the React app first
npm install
npm run build

# Build Docker image
docker build -t headscale-admin-react:latest .

# Run with Docker Compose (add to your existing headscale docker-compose.yml)
docker compose up -d headscale-admin
```

### 5. Docker Compose snippet

Add this service to your existing `docker-compose.yml`:

```yaml
headscale-admin:
  image: headscale-admin-react:latest
  container_name: headscale-admin
  environment:
    - JWT_SECRET=your-jwt-secret-here
    - HEADSCALE_URL=http://headscale:8080
  restart: unless-stopped
  networks:
    - headscale_default
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
    - /etc/headscale:/etc/headscale:ro
  labels:
    - traefik.enable=true
    - traefik.http.routers.headscale-admin.rule=Host(`your-domain.com`) && PathPrefix(`/admin`)
    - traefik.http.routers.headscale-admin.entrypoints=websecure
    - traefik.http.routers.headscale-admin.tls=true
    - traefik.http.middlewares.admin-stripprefix.stripprefix.prefixes=/admin
    - traefik.http.routers.headscale-admin.middlewares=admin-stripprefix
    - traefik.http.services.headscale-admin.loadbalancer.server.port=3000
```

### 6. First login

1. Create a Headscale API key for your admin user:
   ```bash
   headscale apikey create --expiration 90d
   ```
2. Open `https://your-domain.com/admin`
3. Enter your headscale **username** and the **API key**
4. You're in!

---

## Updating

```bash
git pull
npm run build
docker build -t headscale-admin-react:latest .
docker compose down headscale-admin
docker compose up -d headscale-admin
```

---

## Roles

| Role | Access |
|------|--------|
| `super_admin` | Full access to all features |
| `group_admin` | Own domain users/nodes only, can create API keys for their users |
| `user` | Read-only, own profile only |

See [README.md](README.md) for full role documentation.

---

## Attribution

This project is built by [HybridRCG](https://github.com/HybridRCG).  
If you use or deploy this project, please include visible attribution as required by the LICENSE.
