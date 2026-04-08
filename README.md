# Headscale Admin - React Edition

A modern, email-based administration dashboard for Headscale built with React, TypeScript, Zustand, and Express.

## Overview

Headscale Admin React is a complete rewrite moving from Svelte to React for better stability and performance. It provides a clean interface for managing Headscale with email-based authentication and role-based access control.

## Features

✅ Email-Based Authentication - No passwords, just email verification
✅ Role-Based Access Control - Admin, Manager, Viewer roles from Headscale ACL
✅ Modern React Stack - React 18, TypeScript, Zustand, React Router
✅ Express Backend - Proper Node.js server with SPA routing
✅ Docker Ready - Production-ready containerization
✅ Traefik Compatible - Works seamlessly at /admin/ path

## Current Status - v0.1 (MVP)

### Implemented
- Login page with email authentication
- Dashboard with user info and role display
- Logout functionality
- Proper Traefik routing support
- Persistent authentication state

### In Development
- Nodes list and management
- Users management
- ACL policy viewer and editor
- Pre-auth keys management

## Tech Stack

- React 18 + TypeScript
- Zustand for state management
- Express backend
- Docker + Alpine Linux
- Headscale REST API

## Getting Started

### Development
```bash
PUBLIC_URL=/admin npm start
```

### Production
```bash
PUBLIC_URL=/admin npm run build
docker build -t headscale-admin-react:latest .
```

## Architecture

Frontend: React with Zustand state management, React Router for routing
Backend: Express server serving React build files with SPA fallback
API: Headscale REST API integration for user validation and ACL policies

## Authentication Flow

1. User enters email on login page
2. Server validates against Headscale user database (/api/v1/user)
3. Server reads ACL policy to determine role (/api/v1/policy)
4. User logged in with API key stored in localStorage
5. Redirect to dashboard on success
6. Logout clears all session data

## Headscale API Integration

- GET /api/v1/user - Fetch and validate users
- GET /api/v1/policy - Get ACL policy for role determination
- GET /api/v1/node - Fetch nodes (coming soon)

## Docker Configuration

Multi-stage build with Alpine Linux
Express server with static file serving
Proper SPA routing support for React Router

## Integration with Traefik

Works seamlessly with Traefik reverse proxy:
- Traefik strips /admin prefix before forwarding
- PUBLIC_URL=/admin configures asset loading
- Proper routing for all API requests

## Contributing

Contributions welcome! Fork, create feature branch, commit, and submit pull request.

## License

MIT License

## Author

Riaan Grobler (HybridRCG)
riaan@groblers.co.uk

Built with ❤️ for the Headscale community

Status: Early development v0.1 MVP - Ready for testing and feedback!
