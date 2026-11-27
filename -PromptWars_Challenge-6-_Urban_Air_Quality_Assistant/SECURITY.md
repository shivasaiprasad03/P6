# Security notes — BreatheSafe

This describes how the API server and the static build handle requests, input and secrets.

## 1. HTTP & Transport Hardening
- **Helmet Security Headers**: Enforces a strict Content Security Policy (`default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Cross-Origin-Resource-Policy: same-origin`.
- **Fingerprint Removal**: `app.disable('x-powered-by')` prevents Express version disclosure.
- **Permissions-Policy**: Explicitly disables `camera`, `microphone`, `payment`, and `usb`; restricts `geolocation` to `(self)`.
- **Strict CORS Allowlist**: Only origins explicitly listed in `ALLOWED_ORIGINS` (or same-origin requests) are permitted; unauthorized cross-origin requests receive HTTP `403`.

## 2. Input Validation, Sanitization & DoS Protection
- **Strict Schema Validation**: Every query parameter and JSON request body is parsed with **Zod** (`shared/schemas.ts`), enforcing numeric bounds (`lat ∈ [-90, 90]`, `lon ∈ [-180, 180]`), enum allowlists, and strict string length caps.
- **Control Character Stripping**: `sanitizePlainText` removes ASCII control bytes to prevent log injection and delimiter spoofing.
- **Payload Caps**: `express.json({ limit: '16kb', strict: true })` blocks oversized body DoS attempts (`413 Payload Too Large`).
- **Sliding-Window Rate Limiting**: Memory-bounded rate limiter (`server/middleware/rateLimiter.ts`) applies stricter per-IP limits on GenAI routes (`/api/advisor/*`) than read routes and returns standard `RateLimit-*` and `Retry-After` headers.
- **Safe Error Handling**: Centralized error handler (`server/middleware/errorHandler.ts`) never leaks stack traces, file paths, or environment variables.

## 3. GenAI & Upstream API Security
- **Server-Side Secret Isolation**: `GEMINI_API_KEY` is read exclusively on the server via `process.env`, sent via the `x-goog-api-key` HTTP header (never in query strings or browser bundles), and excluded from git via `.gitignore`.
- **Prompt-Injection Defense**:
  - User-supplied focus notes and chat messages are scanned by `detectPromptInjection` and isolated inside `<user_focus_note>` / `<user_question>` delimiters with explicit system instructions treating them as untrusted data.
  - All GenAI JSON outputs are validated against strict Zod output schemas (`aiPlanPayloadSchema`, `aiChatPayloadSchema`) before being served to clients.
- **SSRF Prevention**: Outbound HTTP calls are locked to hardcoded HTTPS origins (`geocoding-api.open-meteo.com`, `air-quality-api.open-meteo.com`, `generativelanguage.googleapis.com`) with validated model names and strict `AbortController` timeouts.
- **Safety Boundaries**: Medical/emergency disclaimers accompany all generated advice; the assistant never diagnoses conditions or advises stopping prescribed medications.

## 4. Container Deployment Hardening
- Multi-stage `Dockerfile` runs `npm ci --ignore-scripts`, prunes `devDependencies`, copies only compiled artifacts into a minimal Alpine Node image, runs as the non-root `node` user, and defines a built-in `HEALTHCHECK`.

## 5. Static build (Firebase Hosting)
- The static build has no server and no secrets: it calls only the three public Open-Meteo endpoints, and plans and answers come from the rule-based engine in the browser. Gemini is never used in this mode.
- `firebase.json` sets a Content Security Policy that limits `connect-src` to those Open-Meteo origins, plus `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a restrictive `Permissions-Policy`.
