# BreatheSafe

A GenAI assistant that helps families and communities get through winter smog. Pick a city and describe your household, and BreatheSafe gives you a plan for the day: when to go outside, how to clean the air at home, which daily habits and swaps to change, and what to do with your neighbours. Every suggestion shows its **direct impact**: how much less polluted air your household breathes, and how much CO₂ and PM2.5 your street avoids if others join in.

**Live site:** https://breathesafe-aq.web.app (static build, using the rule-based advisor; see [Deploying](#deploying))

## How it meets the brief

| The brief asks for | What BreatheSafe does |
| --- | --- |
| Help with severe winter smog and urban air pollution | Live US AQI, six pollutants and a 24-hour PM2.5 forecast for any city (Open-Meteo / Copernicus CAMS), the **cleanest two-hour window**, and how strongly a winter inversion is trapping pollution. |
| Low-emission daily routines | Swapping car trips for transit or carpools (sized to your commute distance), walking and cycling at clean hours on quieter streets, and a no-idling pact. |
| Indoor air quality hacks | A DIY box-fan (Corsi-Rosenthal) filter, timing ventilation and a purifier around the clean window, wet-mopping and sealing gaps. |
| Sustainable alternatives | Electric or induction cooking instead of gas or solid fuel, unscented cleaners instead of incense and sprays. |
| Tailored to location and lifestyle | Uses the city's live readings and forecast, plus household size, sensitive members (babies, children, older adults, asthma, pregnancy, outdoor workers), home type, purifier, cooking fuel, commute and distance, budget, and whether you plan for a family, a school group or a residents' association. A note such as "football at 4 pm" is checked against the forecast for 4 PM. |
| Clearly explaining the direct impact of choices | Each recommendation shows its effect on your PM2.5 dose (also in cigarette-equivalents), and on CO₂ and PM2.5 emitted, for your household and for 100 neighbouring households. The **impact calculator** opens with your plan's actions so you can add or remove them and see the totals change. |
| Communities | A ready-to-send message for a building or parents' group, and community actions written for each role. |

## How GenAI is used, and where it isn't trusted

When `GEMINI_API_KEY` is set on the server, **Google Gemini** writes the daily plan and answers questions in the "Ask a question" tab. The model handles what it is good at, personal and readable advice, and is kept away from the numbers:

1. **Grounded prompt.** The model gets the live readings, the hourly forecast, the household profile and the **action catalog with every figure already tailored to this household** ([server/ai/prompts.ts](server/ai/prompts.ts)). It is told to choose actions from the catalog by id and to quote only the figures it was given.
2. **Validated output.** The response must match a strict Zod schema ([shared/schemas.ts](shared/schemas.ts)), and `actionId` must be a catalog id. Anything else is rejected.
3. **Numbers from code, not the model.** The impact figures shown on each card are attached from the catalog after the model replies ([server/services/aiAdvisorService.ts](server/services/aiAdvisorService.ts)), so a hallucinated number never reaches the screen.
4. **Prompt-injection defence.** User text is stripped of control characters, escaped and wrapped in tags marked as untrusted. Obvious injection attempts never reach the model, and place names are screened before they go into the prompt.
5. **Always works.** If there is no key, or Gemini times out or returns something invalid, the rule-based advisor ([shared/advisor/](shared/advisor/)) produces the plan from the same catalog. The UI says which engine wrote each plan and answer.

## How impact is estimated

All figures come from one file, [shared/actions.ts](shared/actions.ts). They are rough, conservative per-household estimates for a winter month, not measurements.

- **Your dose.** Indoor PM2.5 is estimated as 65% of outdoor PM2.5 (unfiltered winter infiltration). Each action removes a share of that dose, and several actions combine multiplicatively (two 50% cuts make 75%, not 100%), capped at 85%.
- **Cigarette-equivalents.** Berkeley Earth's rule of thumb: 22 µg/m³ of PM2.5 breathed for a day ≈ one cigarette.
- **Tailoring.** Transit-swap savings scale with your commute distance and vehicle (petrol, EV or two-wheeler emission factors), and are zero if you already walk, cycle or take transit. Clean cooking counts for much more with solid fuel than with gas, and for nothing if you already cook on electric. The DIY filter is skipped if you own a purifier.
- **Honest trade-offs.** The DIY filter runs a fan, so it is shown as *adding* about 8 kg of CO₂ a month.
- **Community scale.** Household figures × number of households. Trees = CO₂ ÷ 1.8 kg per mature tree per month.
- **AQI.** US EPA PM2.5 breakpoints (2024 revision). The WHO comparison uses the 2021 24-hour guideline of 15 µg/m³.

If Open-Meteo can't be reached, the app shows typical winter values for the city and labels them clearly as **sample data**. It never invents weather or monitoring stations.

This is general guidance, not medical advice.

## Architecture

```
shared/                Runs on the server AND in the browser (no Node or DOM APIs)
  actions.ts           Action catalog: the single source of every impact figure
  impact.ts            Dose, cigarette-equivalent and community-scale maths; the calculator
  aqi.ts               AQI conversion, cleanest window, inversion risk (pure functions)
  airQuality/          Open-Meteo client (time-zone aware) and the labelled sample report
  advisor/             Rule-based plan and chat engines, prompt-injection guard
  schemas.ts, types.ts Zod schemas; types are derived from them so they can't drift
server/                Express API: Gemini client and prompts, caching, rate limits, security
src/                   React app (components, hooks); lib/browserEngine.ts runs shared/ in the browser
api/                   Vercel serverless entry point
tests/                 Unit, API, security and accessibility tests (Vitest, Supertest, Testing Library)
```

Design choices:

- **One domain layer, two runtimes.** The same `shared/` code powers the API server and the server-less static build, and the impact calculator runs in the browser with no network calls.
- **Time-zone correct.** Open-Meteo is asked for Unix timestamps plus the city's UTC offset, so the forecast starts at the right hour and "2 PM" means 2 PM in that city, whichever time zone the server or the viewer is in.
- **Efficient.** Bounded LRU + TTL caches with request coalescing (air quality per ~1 km cell, city search, plans); live updates over Server-Sent Events; the live clock re-renders only the status line, not the whole page.

## Running it locally

Requires Node.js 22.

```bash
npm install
npm run dev          # web app on http://localhost:5173, API on http://127.0.0.1:3001
```

Copy `.env.example` to `.env` to change settings. Everything works without a key; add `GEMINI_API_KEY` to have Gemini write plans and answers.

| Command | What it does |
| --- | --- |
| `npm run dev` | Web app and API server with hot reload |
| `npm test` | Run the test suite (Vitest) |
| `npm run test:coverage` | Tests with a coverage report |
| `npm run lint` | ESLint, including accessibility (jsx-a11y) rules |
| `npm run typecheck` | TypeScript checks for the app and the server |
| `npm run build && npm start` | Production build, served by the Express server |
| `npm run build:web` | Static build for any static host (rule-based advisor only) |

On Windows, run the tests from a path that starts with an uppercase drive letter (`C:\…`). With `c:\`, Vitest loads two copies of itself and every suite fails with `Cannot read properties of undefined (reading 'config')`.

## Deploying

- **With Gemini (recommended).** Run the Express server, which serves the app and the `/api` routes, with `GEMINI_API_KEY` set. The `Dockerfile` builds a small non-root image for Cloud Run or any container host, for example `gcloud run deploy breathesafe --source . --set-env-vars GEMINI_API_KEY=…`. `vercel.json` deploys the same setup to Vercel.
- **Static only.** `npm run deploy` builds with `VITE_STANDALONE=true` and deploys `dist/client` to Firebase Hosting. Open-Meteo is called from the browser and the rule-based advisor writes the plans. Gemini is never used in this mode, because an API key must never be shipped to a browser.

## Accessibility and usability

Keyboard-operable throughout: WAI-ARIA tabs with arrow keys, a combobox city search, a skip link and visible focus. The forecast chart has a text description and a data-table view. Live regions announce updates. Light, dark and high-contrast themes are included, the layout is responsive and printable, and the app can use your browser's location. Copy is written in plain language.

## Security

See [SECURITY.md](SECURITY.md): Zod validation of every input, a strict CSP and Helmet headers, a CORS allowlist, per-IP rate limits (tighter on AI routes), fixed outbound URLs (no SSRF), the API key kept server-side in a header, and error responses that never leak internals.
