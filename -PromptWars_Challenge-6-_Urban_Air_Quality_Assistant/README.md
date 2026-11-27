# BreatheSafe

BreatheSafe shows the air quality for any city right now and over the next 24 hours, picks out the cleanest hours to be outside, and suggests practical steps a household can take to breathe less polluted air.

**Live site:** https://breathesafe-aq.web.app

## What it does

- **Today:** the current US AQI with its category, the weather, six pollutant readings (PM2.5, PM10, NO₂, O₃, SO₂, CO), the best two-hour window to go outside, and an hourly PM2.5 forecast. The forecast can also be shown as a table.
- **Daily plan:** recommendations based on the readings and on a short household profile (who lives there, home type, cooking fuel, commute, budget). Each one lists steps, timing, cost, and an estimate of how much it cuts exposure. Also includes a message you can copy and send to neighbours or a school group.
- **Impact calculator:** choose habits such as a DIY box-fan filter or switching to public transport, and see the estimated drop in indoor PM2.5 and the CO₂ and PM2.5 avoided when 1 to 1,000 households do the same.
- **Ask a question:** short answers about masks, ventilation, purifiers, cooking smoke and similar topics, based on the city's current readings.

You can search any city or use your current location. Light, dark and high-contrast themes are available. The interface works with a keyboard and a screen reader.

## Where the numbers come from

- Air quality and forecasts: [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api), based on the Copernicus CAMS model. These are modelled values for the city's coordinates, not readings from a street-level sensor.
- Weather: Open-Meteo Forecast API.
- City search: Open-Meteo Geocoding API.
- The cigarette comparison uses the Berkeley Earth rule of thumb (22 µg/m³ of PM2.5 ≈ one cigarette a day). The WHO comparison uses the 2021 24-hour PM2.5 guideline of 15 µg/m³.
- The figures in the plan and the calculator are rough estimates from fixed rules in `shared/constants.ts` and `server/services/impactCalculator.ts`, not measurements.

If Open-Meteo can't be reached, the app shows typical winter values for the city and labels them as sample data.

This is general guidance, not medical advice.

## Running it locally

Requires Node.js 22.

```bash
git clone https://github.com/shivasaiprasad03/breathesafe.git
cd breathesafe
npm install
npm run dev
```

This starts the web app on http://localhost:5173 and the API server on http://127.0.0.1:3001.

Copy `.env.example` to `.env` to change settings. Everything works without a key. If you set `GEMINI_API_KEY`, the server writes plans and answers with Google Gemini. Without it, the server uses the built-in rule-based engine.

## Two ways to deploy

**Static site (used for the live site).** `npm run build:web` builds the app in `standalone` mode. Everything runs in the browser: Open-Meteo is called directly, and plans and answers come from the rule-based engine. The output in `dist/client` can go on any static host.

```bash
npm run deploy   # builds and deploys to Firebase Hosting (project in .firebaserc)
```

**With the API server.** `npm run build && npm start` runs the Express server, which serves the app and the `/api` routes. It adds caching, rate limiting, server-sent live updates and the optional Gemini integration. A `Dockerfile` is included, and `vercel.json` deploys the same setup to Vercel.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Web app and API server with hot reload |
| `npm run build:web` | Static build for Firebase or any static host |
| `npm run deploy` | Static build plus `firebase deploy --only hosting` |
| `npm run build` | Typecheck, then build the web app and server |
| `npm start` | Run the built server |
| `npm test` | Run the test suite (Vitest) |
| `npm run lint` | ESLint, including accessibility rules |
| `npm run typecheck` | TypeScript checks for the app and server |

On Windows, run the tests from a path that starts with an uppercase drive letter (`C:\…`). Vitest loads two copies of itself when the working directory starts with `c:\`, and every suite then fails with `Cannot read properties of undefined (reading 'config')`.

## Project layout

```
src/            React app (components, hooks, styles)
src/lib/        API client; browserEngine.ts runs the app without a server
server/         Express API: Open-Meteo access, plan and answer engines, caching, rate limits
shared/         Types, validation schemas and constants used by both sides
api/            Vercel serverless entry point
tests/          Unit, API and UI tests
```

## Tech

React 19, TypeScript, Vite 7, Express 5, Zod, Lucide icons. The fonts are Fraunces, IBM Plex Sans and IBM Plex Mono, bundled with the app. Tests use Vitest, Testing Library and Supertest.

See [SECURITY.md](SECURITY.md) for how inputs, secrets and outbound requests are handled.
