# STORM PATH — web

Weather-aware navigation. This repository is the **website**. The native client is a **separate** repository: [storm-path-app](https://github.com/dominiccalandro1991-byte/storm-path-app). Do not merge them.

## 1.0 Product

Gale Vector Engine scores a route from precipitation, wind, visibility, radar proxy, and NWS alert weight. Reroute band at **0.72**. Map (MapLibre), Open-Meteo, RainViewer radar + infrared satellite, NWS alerts, OSRM driving directions.

Guest works for map / weather / routing. Google + X sign-in syncs Home, Work, pins, and saved routes to Neon.

## 1.1 Tabs

| Tab | What it is |
|---|---|
| Map | Omnibox, telemetry HUD, radar / IR overlay, timeline −2h…+48h |
| Weather | Now / hourly / daily / alerts / AQI |
| Navigate | Gale-weighted OSRM path, start nav, voice, share, save |
| Saved | Home / Work / pins / routes / incident report |
| Settings | Units, north-up, incognito, export JSON |

## 1.2 Safety

- One database vendor: **Neon** (PGLite in preview)
- Auth: Google + X via Grok broker. Email/password off.
- No Stripe, no IAP, no `/heal`, no trunk write
- Nominatim / NWS run server-side with a Storm Path User-Agent
- Lat/lon clamped. Search queries capped at 80 chars.

## 1.3 Inspection directive

1. This repo is **web only**. Native lives in `storm-path-app`.
2. Do not add CRM, social feeds, or ANVIL stress engines here.
3. Do not add Supabase alongside Neon.
4. Do not call `/heal` or `AUTONOMOUS_TRUNK`.

See [GPS_COVERAGE.md](./GPS_COVERAGE.md).
