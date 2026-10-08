# Kin / Kindred prototype

A mobile-first shared 3D world for trusted people. The prototype uses real,
bundled Lower Manhattan geography and simulated people, permissions and journeys.
No device GPS is collected. Demo state is isolated by browser session and kept in
server memory; restarting the service resets it.

## Run locally

Use Node.js 22.16.0 or newer.

```sh
npm ci --include=dev --no-audit --no-fund
npm run dev
```

The server listens on port 3000 by default. Set `PORT` to change it.

## Verify and run the production build

```sh
npm run build
npm test
npm start
```

Check `/api/health` for the simulated-mode JSON response. Both the UI and the
Express API must run on the same service; this is not a static-site deployment.

## Deploy to Render

The repository includes `render.yaml` with a free Node web service in Singapore.
Create a Render Blueprint from this repository and its `main` branch, review the
service configuration, and deploy it. Render assigns the public HTTPS hostname;
do not assume the requested service name guarantees a specific hostname.

For an existing Render Web Service, use these settings:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Root Directory | Empty (repository root) |
| Build Command | `npm ci --include=dev --no-audit --no-fund && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22.16.0` |

After deployment, check the actual Render URL at `/api/health`, then open the root
page. Try Nearby, a Meet Up request, switching to Sarah to approve it, and
navigation back as Alex. Free services may sleep between visits.

The app needs a continuously running Node process because demo sessions are held
in memory. Travel modes and routes are demonstrations, not live navigation.

## Geography attribution

Buildings and roads are sourced from the vis.gl `deck.gl-data` trips examples
(commit `4b221eff9dc561ee6f19ae914fa395d02e6eecb1`), with OpenStreetMap contributor
attribution. The dataset repository license is retained at
`public/geography/DECK-DATA-LICENSE.txt`. Land polygons are clipped from Natural
Earth's public-domain `ne_10m_land` dataset. Noto Sans map glyphs and their license
are bundled under `public/geography/fonts`. MapLibre provides the 3D renderer.
