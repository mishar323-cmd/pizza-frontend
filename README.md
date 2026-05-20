# pizza-frontend

React 18 + Vite 5 SPA for Дело в пицце. Two entry points:
- `/` — customer site
- `/admin` — admin panel

## Run locally

Backend (`pizza-backend`) must be running on `:8080` for `/api/*` to work.

```sh
npm install
npm run dev               # http://localhost:5173
# Or against a remote backend:
BACKEND_URL=http://194.67.120.49 npm run dev
```

## Build

```sh
npm run build             # outputs dist/index.html, dist/admin/index.html, dist/assets/*
npm run preview           # local preview of build
```

## Docker

```sh
docker build -t pizza-frontend .
docker run --rm -p 8080:80 pizza-frontend
# → http://localhost:8080 (SPA, no /api proxy — reverse proxy lives in pizza-infra)
```

## CI / release

- `ci.yml` — `npm ci && npm run build` on push/PR
- `release.yml` — builds image and pushes to `ghcr.io/mishar323-cmd/pizza-frontend:{latest|dev|sha-XXXX}` on push to main/dev. On main, triggers `pizza-infra` deploy.

## Branches

- `main` — production
- `dev` — staging tag, no auto-deploy
