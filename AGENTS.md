# Personal Guide frontend

## Scope and companion backend

This repository is the web frontend for Personal Guide: authenticated, location-aware walking tours with guide selection, route planning, generated narration, maps, audio playback, and user preferences.

The backend is a separate sibling repository at `../personal-guide.ai/` (from this checkout, `/home/abba/startup/personal-guide.ai`). Inspect it when changing API contracts. The parent directory is a workspace containing both repositories.

The backend owns Firebase token validation, user and tour ownership, MongoDB persistence, route planning, tour preparation/generation, narration, speech synthesis, and background research. This repository owns the browser UI and a Nuxt server proxy. Keep provider credentials and generation logic on the backend.

Read these backend sources for integration work:

- `../personal-guide.ai/current_implementation/api_reference.md`: endpoint contracts and playback semantics.
- `../personal-guide.ai/current_implementation/architecture.md`: services and data flow.
- `../personal-guide.ai/current_implementation/environment_variables.md`: backend configuration.
- `../personal-guide.ai/current_implementation/setup_and_operations.md`: local operations.
- `../personal-guide.ai/app/main.py`: mounted routers and API prefix.
- `../personal-guide.ai/app/api/v1/endpoints/`: guide, user, and tour handlers.
- `../personal-guide.ai/app/models/`: request/response validation; especially `tour_next_request.py`, `tour.py`, and `language.py`.

Treat executable code as authoritative when documentation and types disagree. The observations below describe the source reviewed on 2026-09-28; they do not establish that a live deployment works.

## Stack and commands

The package declares Nuxt 4.4.7, Vue 3.5, TypeScript 6, Pinia 3, Nuxt UI 4, Tailwind CSS 4, VueUse, Firebase/VueFire, Nuxt i18n, and Mapbox GL with Mapbox Directions. It uses ES modules. Nuxt 4.4.4 breaks SPA development with `Vite Node IPC socket path not configured`; use the patched dependency rather than manually setting internal socket environment variables.

- Required Node version: `>=24.x` in `package.json`.
- Package manager: `pnpm@10.33.0`; preserve `pnpm-lock.yaml`.
- `pnpm install --frozen-lockfile`: install dependencies; `postinstall` runs `nuxt prepare`.
- `pnpm dev`: development server, normally port 3000.
- `pnpm build`: production build, with Nuxt TypeScript checking enabled.
- `pnpm typecheck`: explicit Nuxt type checking.
- `pnpm test:smoke`: after a build, exercises Nitro against a local fixture backend (requires local TCP listeners).
- `pnpm test:dev`: runs the same HTTP checks against a temporary development server; catches SPA renderer/IPC regressions missed by production builds. Run separately from builds because both generate `.nuxt` files.
- `pnpm test`: Vitest regression suite; `tests/setup.ts` provides Nuxt auto-import globals and isolated Pinia state.
- `pnpm preview`: preview the production build.
- `pnpm generate`: static generation; the application still needs its `/api/*` server handlers, so a static-only host is insufficient for the current architecture.
- `pnpm prettier:check`: repository formatting check.
- `pnpm exec prettier --check AGENTS.md`: example of a focused formatting check.
- `pnpm prettier`: formats the entire repository; prefer formatting changed files to avoid unrelated churn.

Regression tests cover stores, proxy behavior, authentication boundaries, playback controls, and audio events. There is no ESLint configuration or CI workflow. For code changes, run tests, type checking, a build, and relevant formatting checks, then exercise the affected browser flow with the backend available.

`docker-compose.yml` builds the frontend service `proto`, reads `.env`, and publishes port 3000. The Dockerfile builds Nuxt and starts the generated Nitro server. It uses Node 24.21.0, installs from the lockfile, passes public Firebase/Mapbox build arguments through Compose, and runs the production server as the node user. `.dockerignore` excludes local secrets and generated output. `.nvmrc` selects Node 24. If pnpm is not installed globally, use `corepack pnpm` with your NVM Node environment.

The backend's separate Compose stack publishes the API on port 3001 and MongoDB on host port 27018. It includes bootstrap and preparation, generation, enrichment, and account-deletion workers. Follow its setup documentation; running only an API process does not perform queued preparation. Its business routes have no version prefix by default (`API_V1_STR=""`).

## Application structure

`nuxt.config.ts` sets `srcDir: "app/"`, `serverDir: "server/"`, and `ssr: false`. Browser rendering is client-only, but Nitro still serves the API proxy. Both `~/` and `@/` imports refer to the app source directory.

| Location                                     | Responsibility                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `app/app.vue`, `app/layouts/default.vue`     | App shell, Nuxt UI provider, authentication loader, navigation, global notification modal                                 |
| `app/pages/index.vue`                        | Login entry point                                                                                                         |
| `app/pages/guides/index.vue`                 | Guide catalog and selection                                                                                               |
| `app/pages/create-route/index.vue`           | Start location, duration, suggestions, interest tags, tour creation                                                       |
| `app/pages/tours/index.vue`                  | Tour list and generation progress                                                                                         |
| `app/pages/tours/[tourId].vue`               | Map, narration, playback controls, visitor questions, GPS/manual position                                                 |
| `app/pages/settings.vue`                     | User settings                                                                                                             |
| `app/stores/`                                | Shared Pinia state for users, guides, route creation/listing, active tour, and geolocation                                |
| `app/composables/api/`                       | Browser calls to local `/api/*` routes                                                                                    |
| `app/composables/auth/`                      | Firebase authentication and profile state                                                                                 |
| `app/composables/tour/`                      | Playback state, actions, coordinates, audio, speech, and text synchronization                                             |
| `app/composables/map/`                       | Mapbox directions, markers, geolocation, and manual simulation                                                            |
| `app/composables/ui/`                        | Notifications, page titles, and navigation helpers                                                                        |
| `app/components/`                            | Product components (`PG*`), settings, authentication, and tour text                                                       |
| `app/components/ui/`, `app/components/base/` | Reusable controls, maps, selectors, and modals                                                                            |
| `app/types/`                                 | Handwritten frontend API and UI types                                                                                     |
| `server/api/`                                | Nitro route handlers translating/forwarding backend requests                                                              |
| `server/utils/http.ts`                       | Upstream URL construction, auth forwarding, request IDs, timeout/retry, errors                                            |
| `app/composables/server/useExternalApi.ts`   | Server-only request helper, despite its location under `app/`                                                             |
| `i18n/locales/`                              | English and Russian UI messages (French translations remain on disk but are not offered while the backend rejects French) |
| `app/assets/css/main.css`                    | Tailwind imports, theme/compatibility rules, desktop phone frame                                                          |

Use Vue composition functions and `<script setup lang="ts">` for new typed components. Follow nearby component conventions and reuse existing controls and notification helpers. Nuxt auto-imports composables/components; `components/ui` has `pathPrefix: false`. TypeScript enables strict checks. Prettier uses the Tailwind plugin.

The UI uses a mobile layout; above 768px the app sits inside a phone-style frame. Check both viewport sizes for layout changes. Update locale files for user-facing text; i18n uses no URL prefix, English fallback, and the `i18n_redirected` cookie.

## Authentication and request flow

1. Firebase/VueFire authenticates the browser. Auth actions include email/password registration and login, and Google popup login.
2. `app/middleware/auth.global.ts` redirects unauthenticated private-page requests to `/` with a `next` query. Authenticated visitors normally enter `/tours`; pages can declare `meta.public`.
3. `app/plugins/01-api-fetch.client.ts` provides `$apiFetch`, adding the current Firebase ID token to `/api/*` requests. Use this authenticated client in API composables.
4. `server/middleware/require-auth.ts` requires a nonempty Bearer header for private `/api/*` requests. It checks header presence, not token validity. `/api/health` and `/api/public` prefixes are exempt, but the checkout does not implement matching handlers.
5. `useExternalApi` delegates to `forwardAuthAndFetch`, which forwards Authorization and an incoming or generated `X-Request-ID`. The backend validates the token and enforces ownership.

The proxy defaults to a 120-second timeout, one retry for reads, and no automatic retry for mutations. It forwards `Idempotency-Key` for narration retries. When a base URL is configured, it rejects upstream URLs from other origins. Keep upstream API URLs private. Do not log credentials, profile bodies, or visitor messages.

## Endpoint mapping and environment

Copy `.env.example` to a local ignored `.env` and fill in the public Firebase and Mapbox configuration. Endpoint-specific variables are optional because the handlers default to the sibling backend's paths. These are example paths for the default backend routing, not production configuration:

| Frontend endpoint                    | Backend endpoint                          | Environment variable                                     |
| ------------------------------------ | ----------------------------------------- | -------------------------------------------------------- |
| `GET /api/guides`                    | `GET /guides/`                            | `PG_API_GUIDES_URL=/guides/`                             |
| `GET /api/route-suggestions`         | `GET /guides/route_suggestions/{guideId}` | `PG_API_ROUTE_SUGGESTION_URL=/guides/route_suggestions/` |
| `POST /api/create-tour`              | `POST /tours/`                            | `PG_API_CREATE_ROUTE_URL=/tours/`                        |
| `GET /api/list-tours`                | `GET /tours/`                             | `PG_API_LIST_TOURS_URL=/tours/`                          |
| `GET /api/get-tour/{tourId}`         | `GET /tours/{tourId}`                     | Reuses `PG_API_LIST_TOURS_URL`                           |
| `POST /api/get-tour-record/{tourId}` | `POST /tours/{tourId}/next`               | Reuses `PG_API_CREATE_ROUTE_URL`                         |
| `GET /api/user-profile`              | `GET /users/me/`                          | `PG_API_GET_ME=/users/me/`                               |
| `POST /api/finish-tour/{tourId}`     | `POST /tours/{tourId}/finish`             | Reuses `PG_API_CREATE_ROUTE_URL`                         |
| `PUT /api/user-profile`              | `PUT /users/me/`                          | `PG_API_UPDATE_ME=/users/me/`                            |

Set `PG_API_BASE_URL=http://localhost:3001` for a frontend process running on the host. `nuxt.config.ts` reads it into private `runtimeConfig.pgApiBaseUrl`; `NUXT_PG_API_BASE_URL` is the matching Nuxt runtime override for a built server. Handlers read the endpoint-specific variables from `process.env`. Absolute endpoint URLs also work, subject to the configured origin check. The endpoint helper normalizes trailing slashes when appending IDs. In containers, `localhost` refers to that container; frontend Compose uses `host.docker.internal:3001` with a host-gateway mapping. Override `DOCKER_PG_API_BASE_URL` if the backend is elsewhere.

Additional configuration:

- `NUXT_PUBLIC_MAPBOX_GL_ACCESS_TOKEN`: public browser Mapbox token.
- `VUEFIRE_API_KEY`, `VUEFIRE_AUTH_DOMAIN`, `VUEFIRE_PROJECT_ID`, `VUEFIRE_STORAGE_BUCKET`, `VUEFIRE_MESSAGING_SENDER_ID`, `VUEFIRE_APP_ID`: Firebase client configuration read by `nuxt.config.ts`.
- `RECAPTCHA_KEY`: optional Firebase App Check site key. App Check is configured only when this is set; development uses the debug token flag with the supported ReCaptchaEnterprise provider.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: optional server credential support in `server/plugins/service-account.ts`. Nitro writes a private temporary file with mode 0600, sets `GOOGLE_APPLICATION_CREDENTIALS`, and removes it on shutdown. Ordinary browser sign-in and proxy forwarding do not need Firebase admin credentials here.

Supply config-time values when building; changing only the runtime environment does not necessarily change compiled Firebase configuration. Keep Firebase admin/service-account credentials out of public runtime config, source control, documentation, and browser bundles. Use the same Firebase project as the backend token verifier. Do not copy values from neighboring credential files.

## Data and behavior conventions

- API coordinates use `{ lat, lng }` strings. Mapbox/GeoJSON uses numeric `[longitude, latitude]`. Convert at the boundary and preserve order.
- Route suggestion duration is total tour minutes (backend range 5–480). `/next` duration is narration seconds (0–300), and pace is metres per second (0–15).
- Route suggestions validate bounds and translate `lat`/`lng` into `curr_lat`/`curr_lng`; the proxy derives map coordinates from the first route. Creation sends that route's points, selected `guide_id`, and selected tags as `{ name, value }` settings.
- Guide and tour list proxies unwrap `{ guides }` and `{ tours }` into arrays. `useGetTourRecord` combines `record` with response-level `places` and `audio_data`.
- `routeStore` polls lists every five seconds while a tour has status `GENERATING` without a preparation error. The list page stops polling on exit and distinguishes loading, empty, and failed states.
- `tourStore` caches the current tour and manages narration text, visitor questions, and places. Its `/next` request uses duration 100, the selected `type_llm` (default `DEFAULT`), and the selected voice type. GPS requests include available accuracy and fix timestamp; unknown pace is omitted. Uncertain narration failures retain the original request payload and operation ID even if GPS changes. Definitive input/auth rejections discard that pending operation.
- `useTourState` saves state/audio position under `tour-state-{tourId}` with a 24-hour expiry. Audio resume rewinds five seconds. Restoration requires the matching in-memory audio record and restores paused state, never an active player after a page reload.
- `useTourAudioPlayer` plays base64 audio through an HTML audio element and estimates text highlighting from playback progress. Clean up object URLs, audio, Mapbox objects/listeners, timers, and geolocation watchers when modifying lifecycle code.
- GPS is the default position mode; manual mode uses a draggable simulation marker. `usePositionMode` shares the choice through Nuxt state and persists it under `tour-position-mode`. Missing GPS must not fall back to a landmark; route-point fallback is for manual simulation only. Maps initialize even if location permission is denied.
- `userStore` keeps guest language under `personal-guide-user-lang`. The preferences plugin loads the backend profile after authentication. The current update proxy sends only `name` and `language`; voice choice persists locally under `personal-guide-voice`. Statistics remain hidden until populated. Firebase identity changes reset owner-specific tour/guide state and invalidate in-flight responses.

## Playback and remaining product scope

- Supported languages are English and Russian, matching the backend `Language` enum. French translation files alone do not establish backend narration support.
- Voice choices are `DEFAULT`, `CARTESIA`, and `MOCK`; default selection delegates to backend configuration. MOCK means sample audio, not generated speech or browser TTS. Real speech requires a configured backend provider.
- The tour page handles nullable audio and intentional `WAIT` responses without appending empty text or starting playback. Text highlighting uses shared state. Autoplay rejection leaves a Play action available.
- Pause/resume send persistent backend controls using duration-zero requests. These requests do not replace the current playable record. Segment start/completion/interruption acknowledgements are serialized. Account/tour-scoped `pg-playback-{user_id}-{tour_id}` recovery records retain segment delivery state and pending request payloads/keys across reloads, and are removed after successful completion. They contain no bearer tokens or audio. Completion calls `/finish` and navigates only on success.
- The backend supports generation history/status, regeneration, cancellation, acceptance, private artifacts, enrichment inspection, and account deletion. Adding screens for these is deferred by user instruction; keep existing tour flows compatible without implying those screens exist.
- The backend supports additional route options (destination, interests, wheelchair routing, stop time) beyond the current UI. Frontend types are handwritten; compare against Python models when extending them.
- Browser authentication, real Mapbox rendering/GPS, and provider-backed speech need valid configuration and interactive verification. Unit tests and a build do not establish end-to-end provider behavior.

## Validation and change discipline

For an API change, trace the browser composable, Nitro handler, forwarding helper, backend endpoint, and Python model together. Check ownership/authentication and response transformations as well as the happy path. Avoid adding direct browser calls to privileged backend/provider APIs.

For UI or playback changes, exercise login/redirect, guide selection, route creation/progress, tour loading, GPS and manual coordinates, play/pause/resume, visitor questions, navigation cleanup, and the affected settings. Include empty/error and silent-response cases relevant to the change. Manual simulation helps test without physical travel; it is not evidence of real GPS behavior.

Keep changes within the requested scope and check each repository's working tree before editing. Do not modify the backend merely to hide a frontend contract mismatch. Do not edit generated `.nuxt/`, `.output/`, or dependency files by hand. Keep this guide current when architecture, commands, environment variables, or contracts change.

Node is installed through NVM. Noninteractive shells may need `source "$HOME/.nvm/nvm.sh"` before using Node/Corepack. See README for local setup. The regression suite uses controlled dependencies; live provider behavior still requires browser testing.

Model type is selectable in Settings (`DEFAULT`, `SIMPLE`, `OPENAI`, `GEMINI`, `MOCK`, `PERPLEXITY`, matching backend `TypeLLm`). It persists locally under `personal-guide-llm` and is sent as `type_llm` on new narration/control requests. Uncertain retries retain their original model and payload. Reset settings restores `DEFAULT`; changing the selection does not generate narration immediately.
