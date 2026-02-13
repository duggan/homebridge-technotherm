# CLAUDE.md

## Project overview

Homebridge dynamic platform plugin for Technotherm / Lucht LHZ electric radiators. Communicates with the Helki cloud API using OAuth2 authentication and Socket.io for real-time device updates. Written in TypeScript, compiled to CommonJS, targeting Node.js 18, 20, 22, and 24.

## Common commands

```sh
npm run build       # Clean dist/ and compile TypeScript
npm run lint        # ESLint with zero warnings tolerance (--max-warnings=0)
npm run pre         # Lint + build (pre-publish check)
npm run watch       # Build, npm link, and nodemon for local dev with Homebridge
npm run makeBeta    # Bump version to next beta prepatch
npm run publishBeta # Publish beta to npm
```

## Architecture

Five source files in `src/`:

- **index.ts** — Entry point. Registers the platform with Homebridge via `api.registerPlatform()`.
- **settings.ts** — Constants: `PLATFORM_NAME` and `PLUGIN_NAME`.
- **platform.ts** — `Technotherm` class (implements `DynamicPlatformPlugin`). Handles plugin lifecycle, device discovery, and accessory registration. Creates `HelkiClient`, fetches grouped devices and nodes, instantiates `Radiator` per node. Implements exponential backoff retry on network errors during discovery.
- **radiator.ts** — `Radiator` class. Manages a single HomeKit Thermostat service per radiator node. Maps device modes (auto/manual/off) to HomeKit heating states. Subscribes to real-time updates via Socket.io.
- **helki_client.ts** — `HelkiClient` class. HTTP and WebSocket client for the Helki API. Handles OAuth2 token lifecycle with automatic refresh (60s buffer before expiry). Uses axios-retry (5 retries, exponential backoff, retries on network errors and 429s).

**Plugin flow:** index registers platform class → Homebridge instantiates `Technotherm` → `didFinishLaunching` triggers `discoverDevices()` → HelkiClient fetches devices → Radiator instances created → Socket.io subscriptions for real-time state sync.

## Code style and conventions

Enforced by ESLint (`.eslintrc`) with zero warnings tolerance in CI:

- Single quotes, 2-space indentation
- Semicolons (via `@typescript-eslint/semi`)
- Trailing commas on multiline (`always-multiline`)
- Max line length: 140 characters
- Always use braces with control flow (`curly: all`)
- Prefer arrow callbacks
- Never use `console.log` — use the Homebridge `log` object (`log.debug`, `log.info`, `log.warn`, `log.error`)
- TypeScript strict mode enabled, but `noImplicitAny` is false

## Key patterns

- **Error handling:** try-catch with `error instanceof Error` type narrowing before accessing `.message`
- **Network resilience:** axios-retry at the HTTP layer + exponential backoff (1s initial, 60min max) at the platform discovery layer
- **Config filtering:** optional `config.home` field restricts accessories to a single home name
- **Accessory caching:** UUIDs generated from `deviceId + nodeAddr` for Homebridge cache restoration
- **Real-time updates:** Socket.io v2 subscription per device; reconnection refreshes the OAuth token

## Important notes

- Default branch is `latest`, not `main`
- No tests exist yet (`tsconfig.json` excludes `**/*.spec.ts` but none are written)
- CI runs lint + build on Node 18, 20, 22, and 24 via GitHub Actions
- `socket.io-client` is pinned to v2 — required by the Helki API server
- Published to npm as `homebridge-technotherm`; `.npmignore` excludes source and config files from the package
- Plugin config schema is in `config.schema.json` (used by Homebridge UI)
