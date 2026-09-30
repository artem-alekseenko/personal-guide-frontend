# Personal Guide frontend

A mobile-first web app for location-aware walking tours. Choose a guide, plan a route, follow named stops on a map, and request narration or ask questions during your walk. The optional current-stop text panel adds explanations, activities, navigation instructions, and source links.

This repository contains the browser UI and a Nuxt server proxy. The sibling [Personal Guide backend](../personal-guide.ai/README.md) handles authentication validation, route planning, tour preparation, persistence, research, and speech generation.

## Features

- Firebase sign-in with email/password or Google, with account-scoped tour state.
- Guide selection, route variants, ordered stop previews, and generation progress.
- Optional interests, excluded topics, pace, and personal context for route planning.
- Mapbox maps, GPS positioning, and a draggable marker for manual simulation.
- Narration controls, visitor questions, and durable playback recovery.
- English and Russian UI, with language, voice, and model preferences.
- An opt-in text experience with stop selection, questions, backend navigation instructions, and explicit save/clear actions for future preferences.

The layout fills a mobile viewport and uses a phone-style frame on desktop. Route previews report unknown access and opening conditions; step-free routing needs verified accessibility along the whole path. Generation-management and account-deletion screens remain outside the current UI scope.

## Stack

Nuxt 4, Vue 3, TypeScript, Pinia, Nuxt UI, Tailwind CSS, VueUse, Firebase/VueFire, Nuxt i18n, and Mapbox GL. The app renders in the browser (`ssr: false`); Nitro serves its authenticated `/api/*` proxy.

Use Node 24 and the pinned `pnpm@10.33.0` through Corepack. Preserve `pnpm-lock.yaml` when installing dependencies.

## Local setup

Keep the repositories next to each other:

```text
startup/
├── frontend/
└── personal-guide.ai/
```

From `frontend/`, install dependencies and create a local configuration file:

```sh
source "$HOME/.nvm/nvm.sh"
nvm use
corepack pnpm install --frozen-lockfile
# Keep an existing .env; copy the example only for a new checkout.
test -f .env || cp .env.example .env
```

Fill in `.env` using the configuration below. Use the same Firebase project as the backend and enable the sign-in methods you intend to use. Keep provider keys and Firebase service-account credentials on the backend; this frontend uses public Firebase client configuration and a public Mapbox token.

Start the backend **and its workers** using the [backend setup guide](../personal-guide.ai/current_implementation/setup_and_operations.md). Running the API alone does not process queued tour preparation. The backend Compose stack exposes the API on port 3001.

Start the frontend:

```sh
corepack pnpm dev
```

Open [localhost:3000](http://localhost:3000), sign in, choose a guide, and create a route. Allow location access for GPS, or use manual mode to simulate a walk. Your browser needs a secure context for geolocation; localhost supports local development.

## Configuration

See [.env.example](.env.example) for the complete template. Keep `.env` out of source control.

| Variable                                                                  | Purpose                                                                                             |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `PG_API_BASE_URL`                                                         | Backend origin for host development; defaults in the example to `http://localhost:3001`.            |
| `NUXT_PG_API_BASE_URL`                                                    | Backend origin override for a built Nitro server.                                                   |
| `DOCKER_PG_API_BASE_URL`                                                  | Backend origin from the frontend container; Compose defaults to `http://host.docker.internal:3001`. |
| `VUEFIRE_API_KEY`, `VUEFIRE_AUTH_DOMAIN`, `VUEFIRE_PROJECT_ID`            | Firebase client project configuration.                                                              |
| `VUEFIRE_STORAGE_BUCKET`, `VUEFIRE_MESSAGING_SENDER_ID`, `VUEFIRE_APP_ID` | Remaining Firebase client configuration.                                                            |
| `NUXT_PUBLIC_MAPBOX_GL_ACCESS_TOKEN`                                      | Public browser Mapbox token.                                                                        |
| `RECAPTCHA_KEY`                                                           | Optional Firebase App Check site key.                                                               |
| `NUXT_PUBLIC_TEXT_EXPERIENCE_ENABLED`                                     | Enables the current-stop text panel; defaults to `false`.                                           |

Endpoint overrides such as `PG_API_GUIDES_URL` and `PG_API_CREATE_ROUTE_URL` are optional. The proxy defaults match the sibling backend's `/guides/`, `/tours/`, and `/users/me/` paths. See [AGENTS.md](AGENTS.md#endpoint-mapping-and-environment) for the full mapping.

Firebase client configuration comes from `nuxt.config.ts` at build time. Rebuild after changing it. The backend origin stays private: browser API clients call the same-origin `/api/*` routes, attach Firebase ID tokens, and let Nitro forward them to the backend for validation and ownership checks.

## Current-stop text experience

Enable both sides:

```dotenv
# Frontend .env
NUXT_PUBLIC_TEXT_EXPERIENCE_ENABLED=true
```

Set `TEXT_EXPERIENCE_ENABLED=true` in the backend configuration and restart the affected services. Without both flags, the text panel or backend endpoints remain unavailable.

In the panel, select a stop, ask a question, or use the navigation shortcuts. Navigation instructions and status come from the backend. GPS sharing requires a fresh fix and GPS mode; a manual simulation marker does not represent your physical location.

Per-tour context edits apply to that walk. Use the save action to update preferences for future tours, or the explicit clear action to remove them. New route drafts load those saved preferences without overwriting edits you made while the profile loaded.

Earlier conversation turns display their stop and source links available in the current session. The panel explains when the backend no longer supplies links for an older turn. If a request has an uncertain outcome, retry it or reload to reconcile state. Text activities do not pause existing audio.

## Commands and verification

| Command                        | Purpose                                               |
| ------------------------------ | ----------------------------------------------------- |
| `corepack pnpm dev`            | Run the development server.                           |
| `corepack pnpm test:text`      | Run the approved nonaudio regression checks.          |
| `corepack pnpm typecheck`      | Check TypeScript and Vue types.                       |
| `corepack pnpm build`          | Build the production Nitro server and browser assets. |
| `corepack pnpm preview`        | Preview a production build.                           |
| `corepack pnpm prettier:check` | Check repository formatting.                          |

For the current milestone, run:

```sh
corepack pnpm test:text
corepack pnpm typecheck
corepack pnpm build
# Check changed files; replace these paths with yours.
corepack pnpm exec prettier --check README.md AGENTS.md
```

`test:text` covers text interactions, route contracts, GPS update coordination, navigation display, safe rendering, saved preferences, request serialization, authentication boundaries, route draft restoration, map following, accessible controls, notifications, and loading/error states. Its Vue component checks render in Node; they do not launch a browser.

**Audio verification requires explicit human approval.** Do not generate, listen to, test, or benchmark audio under the current milestone. The full `test`, `test:smoke`, and `test:dev` suites include audio and are excluded until that approval. After approval, `test:smoke` requires a build; run `test:dev` separately from builds because both write `.nuxt` files.

Check sign-in, maps, GPS, and provider-backed text in a configured browser. Passing unit tests and a build does not establish live provider behavior or route accessibility. Format changed files rather than running `pnpm prettier` across unrelated files.

## Docker and deployment

After configuring `.env` and starting the backend:

```sh
docker compose up --build
```

The frontend service `proto` exposes port 3000. Compose passes public Firebase/Mapbox configuration as build arguments and supplies `.env` at runtime. On Linux, the host-gateway mapping lets the container reach the host backend through `host.docker.internal:3001`. Set `DOCKER_PG_API_BASE_URL` when the backend runs elsewhere.

For a host production deployment:

```sh
corepack pnpm build
NUXT_PG_API_BASE_URL=http://localhost:3001 node .output/server/index.mjs
```

Deploy the Nitro server as well as the browser assets. A static-only host cannot serve the authenticated `/api/*` routes required by this application. Use HTTPS for deployed sign-in and GPS flows.

## Repository map

| Path                   | Responsibility                                                                    |
| ---------------------- | --------------------------------------------------------------------------------- |
| `app/pages/`           | Login, guides, route creation, tours, and settings.                               |
| `app/components/tour/` | Route preview, playback text, and current-stop experience.                        |
| `app/stores/`          | User preferences, route drafts, tours, text state, GPS, and request coordination. |
| `app/composables/`     | API clients, authentication, maps, tour actions, and UI helpers.                  |
| `server/api/`          | Authenticated backend proxy handlers.                                             |
| `server/utils/http.ts` | Upstream URLs, auth forwarding, request IDs, timeouts, and retry rules.           |
| `i18n/locales/`        | UI translations; English and Russian are offered.                                 |
| `tests/`               | Vitest regressions and component rendering checks.                                |
| `scripts/smoke.mjs`    | Production/development HTTP fixture checks, subject to audio approval.            |

## Troubleshooting

| Symptom                                                        | Check                                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node or pnpm is missing                                        | Source NVM, run `nvm use`, and use `corepack pnpm`.                                                                                              |
| Sign-in fails or the API rejects a token                       | Check Firebase client configuration, enabled sign-in providers, and the backend's Firebase project. Rebuild after changing client configuration. |
| Proxy reports an upstream configuration or connection error    | Check the backend origin, port 3001, and backend availability. Inside Docker, use the host-gateway origin rather than container `localhost`.     |
| A tour remains in preparation                                  | Check backend preparation/generation workers and the preparation error shown on the tour list.                                                   |
| No route variants appear                                       | Read the backend explanation and adjust start, duration, or preferences. Empty suggestions can indicate an infeasible or unverified route.       |
| The map or GPS is unavailable                                  | Check the Mapbox token, browser location permission, and secure context. Manual simulation allows route exploration without a live fix.          |
| The text panel is missing or unavailable                       | Check both feature flags and backend text-provider configuration.                                                                                |
| Development reports `Vite Node IPC socket path not configured` | Install the pinned lockfile dependencies. This project uses Nuxt 4.4.7; avoid downgrading to the affected 4.4.4 release.                         |

For integration changes, read [AGENTS.md](AGENTS.md), the [backend API reference](../personal-guide.ai/current_implementation/api_reference.md), and the [backend architecture](../personal-guide.ai/current_implementation/architecture.md). Check executable handlers and Python models when documentation and client types disagree.
