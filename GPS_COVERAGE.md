# STORM PATH — GPS checklist coverage

Source spec: `GPS-anything-weather-checklist.md`. Two repositories. Never merge.

| Spec | Web (`storm-path-web`) | App (`storm-path-app`) |
|---|---|---|
| Splash / first-run units / Home Work / alerts | Yes | Units + origin; Home/Work on Saved |
| Auth | Guest + Google + X (Grok broker). No Apple / Microsoft / OTP / email | Native session later; guest map works now |
| Omnibox + Gas/Food/Parking/Shelter | Nominatim, GPS-biased | Nominatim from device |
| 5-tab nav Map / Weather / Navigate / Saved / Settings | Desktop sidebar + mobile bar | Expo tabs |
| Map styles Dark/Default/Satellite/Terrain | MapLibre raster | react-native-maps Standard/Satellite/Hybrid/Terrain |
| Radar + IR satellite + timeline −2h…+48h | RainViewer tiles | Native radar tiles need MapLibre Native (dev client) |
| Telemetry HUD spd/alt/hdg/CEP/pressure | Geolocation API | expo-location + barometer/heading sensors |
| Gale Vector 0.34/0.22/0.12/0.20/0.12 · reroute 0.72 | Shared engine | Identical copy in `src/engines` |
| OSRM driving + along-route weather samples | Server fn, 8 samples / 15 km | Same public OSRM from device |
| Incident report crash/trap/hazard/weather | Neon, signed-in | Local queue |
| Export JSON / clear history / incognito | Yes | AsyncStorage export |
| Always-allow location, motion, barometer, push, haptics | Web cannot | Native permissions |
| IAP / Stripe / MFA / 50-language TTS / contacts | **Out of scope** | **Out of scope** |
| Neon | Per-user prefs/places/routes/reports | No Neon in this repo |

Standing exclusions: CRM, social feed, ANVIL Mesh/NASE, Supabase, `/heal`, `AUTONOMOUS_TRUNK`.
