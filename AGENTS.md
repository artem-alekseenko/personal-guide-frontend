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

Treat executable code as authoritative when documentation and types disagree. The observations below describe the source reviewed on 2026-09-29; they do not establish that a live deployment works.

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

## Local setup

Run from this repository:

```sh
source "$HOME/.nvm/nvm.sh"
nvm use
corepack pnpm install --frozen-lockfile
# Create .env from .env.example only if .env does not already exist.
corepack pnpm dev
```

Before starting the app, configure `.env` as described below and start the backend and its workers using the sibling repository's setup guide. Do not overwrite an existing `.env`. The frontend needs no local MongoDB connection; it reaches persistence through the backend. `.npmrc` enables hoisting and pre/post scripts. Preserve these settings when investigating dependency or Nuxt auto-import failures.

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
| `shared/types/`, `shared/utils/`             | Shared interaction preferences, personal-context defaults and command reconciliation helpers (`#shared`)                  |
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
5. The client attaches tokens only to same-origin `/api/` requests, shares concurrent token retrieval for the same UID, and rejects a request if the identity changes while awaiting its token. Preserve this boundary when adding API clients.
6. `useExternalApi` delegates to `forwardAuthAndFetch`, which forwards Authorization and an incoming or generated `X-Request-ID`. The backend validates the token and enforces ownership.

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
- Route suggestion duration is total tour minutes (backend range 5–480; current creation slider 5–60). `/next` duration is narration seconds (0–300), and pace is metres per second (0–15).
- Route suggestions validate bounds and translate `lat`/`lng` into `curr_lat`/`curr_lng`; the proxy derives map coordinates from the first route. Creation sends that route's points, selected `guide_id`, and selected tags as `{ name, value }` settings.
- Guide and tour list proxies unwrap `{ guides }` and `{ tours }` into arrays. `useGetTourRecord` combines `record` with response-level `places`, `audio_data`, and `route_points`. The tour store applies returned route points to the active route.
- `routeStore` polls lists every five seconds while a tour has status `GENERATING` without a preparation error, and retries list failures on the same schedule. The list page stops polling on exit and distinguishes loading, empty, and failed states.
- `tourStore` caches the current tour and manages narration text, visitor questions, and places. Its `/next` request uses the selected `type_llm` (default `DEFAULT`) and voice type. `shared/utils/tourNarration.ts` requests `STATIONARY` with a 90-second target when fresh GPS is within the conservative stop threshold, `QUESTION` with 90 seconds for visitor text, or `WALKING` with 20 seconds otherwise. Backend evidence and mode budgets still determine actual length. GPS requests include available accuracy and fix timestamp; unknown pace is omitted. Uncertain narration failures retain the original request payload and operation ID even if GPS changes. Definitive input/auth rejections discard that pending operation.
- `useTourState` saves state/audio position under `tour-state-{tourId}` with a 24-hour expiry. Audio resume rewinds five seconds. Restoration requires the matching in-memory audio record and restores paused state, never an active player after a page reload.
- `useTourAudioPlayer` plays base64 audio through an HTML audio element and estimates text highlighting from playback progress. Clean up object URLs, audio, Mapbox objects/listeners, timers, and geolocation watchers when modifying lifecycle code.
- GPS is the default position mode; manual mode uses a draggable simulation marker. `usePositionMode` shares the choice through Nuxt state and persists it under `tour-position-mode`. Missing GPS must not fall back to a landmark; route-point fallback is for manual simulation only. Maps initialize even if location permission is denied.
- `userStore` keeps guest language under `personal-guide-user-lang`. The preferences plugin loads the backend profile after authentication. The current update proxy sends only `name` and `language`; voice choice persists locally under `personal-guide-voice`. Statistics remain hidden until populated. Firebase identity changes reset owner-specific tour/guide state and invalidate in-flight responses.

## State, preferences, and navigation

- `guidesStore` holds the guide catalog and selected guide in memory with a one-hour cache TTL. Catalog responses include owner-specific tours; do not restore the old persistent guide cache. Creation redirects to `/guides` when no guide is selected.
- `routeStore` owns the start point, duration, suggested route, tags, newly created tour, and tour list. Creation uses the first suggested route and navigates to `/tours` after success. Request versions prevent stale responses from repopulating reset stores.
- `tourStore` owns the active tour, playable record, accumulated transcript, pending visitor message, and playback recovery. Switching tours resets transcript and playback state. `useTourActions` coordinates requests, audio, acknowledgements, and completion; keep page event handlers thin.
- `geolocationStore` owns coordinates, accuracy, ISO fix timestamp, and the browser watch. The client plugin initializes location at startup and stops the watch on unload. Geolocation requests use high accuracy with a ten-second timeout; permission denial fails without retrying, while timeout/unavailable errors allow up to three retries.
- `useAuth.updateUserPreferences` applies settings locally and sends a profile update when language changes. Failed saves restore previous preferences if the same user remains signed in. `SettingsSavingOverlay` covers pending saves. Voice/model-only changes remain local.
- Model type is selectable in Settings (`DEFAULT`, `SIMPLE`, `OPENAI`, `OPENAI_MINI`, `OPENAI_FULL`, `GEMINI`, `MOCK`, `PERPLEXITY`, matching backend `TypeLLm`). New narration/control requests include the selection as `type_llm`; uncertain retries retain their original model and payload. Changing the selection does not request narration. Reset settings restores English and `DEFAULT` voice/model. `OPENAI_MINI` and `OPENAI_FULL` resolve through backend `OPENAI_MINI_MODEL` and `OPENAI_FULL_MODEL`; keep configurable model version names out of frontend labels. Enum support does not establish that a provider has working credentials.
- `settings-navigation.global.ts` remembers the entry route. `useBackNavigation` maintains up to ten prior paths, excludes login/settings entries, and clears its history on logout. Preserve return-to-tour behavior when editing settings navigation.

Browser storage reference:

| Key                               | Storage | Purpose and lifetime                                                                                          |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `personal-guide-user-lang`        | Local   | Language fallback; backend profile can replace it after login                                                 |
| `personal-guide-voice`            | Local   | Device voice preference                                                                                       |
| `personal-guide-llm`              | Local   | Device model preference                                                                                       |
| `tour-position-mode`              | Local   | Shared GPS/manual choice                                                                                      |
| `tour-state-{tourId}`             | Local   | UI state and audio position; expires after 24 hours and needs matching in-memory audio                        |
| `pg-playback-{user_id}-{tour_id}` | Local   | Segment checkpoint and pending narration/control payloads and operation keys; removed after successful finish |
| `navigationHistory`               | Local   | Bounded back-navigation history                                                                               |
| `settingsReturnRoute`             | Session | Route to return to from settings                                                                              |
| `i18n_redirected`                 | Cookie  | Locale selection                                                                                              |

Playback recovery can include location and pending visitor text. It contains no bearer token or audio; do not copy it into logs or diagnostics without redaction. The preferences plugin clears `tour-state-*` and obsolete `pg-guides-*` cache keys on UID changes. Account-scoped playback recovery survives reloads separately from UI/audio state; do not conflate their lifetimes.

## Playback and remaining product scope

- Supported languages are English and Russian, matching the backend `Language` enum. French translation files alone do not establish backend narration support.
- Voice choices are `DEFAULT`, `CARTESIA`, and `MOCK`; default selection delegates to backend configuration. MOCK means sample audio, not generated speech or browser TTS. Real speech requires a configured backend provider.
- The tour page handles nullable audio and intentional `WAIT` responses without appending empty text or starting playback. Text highlighting uses shared state. Autoplay rejection leaves a Play action available.
- Narration is request-driven. The main button starts/continues narration, pauses active audio, or resumes a paused segment. Visitor questions request a new turn. Dragging the simulation marker requests a turn only in `RECORD_FINISHED`. GPS watches update position but do not schedule `/next`; audio completion acknowledges the segment. Automatic same-stop continuation, when enabled and eligible, uses the separate story-buffer contract described below. The map's route timer only retries route rendering.
- `useTourActions.isBusy` blocks overlapping user actions. `onAudioEnded` sends `COMPLETED`; starting another turn or finishing interrupts an unfinished segment. `dispose()` stops local audio and ignores late UI work. Do not assume browser unload can deliver an acknowledgement; preserve durable recovery.
- Backend guidance actions include `ARRIVE`, `CONTINUE`, `WALK`, `ANSWER`, `LOCATE`, `COMPLETE`, and `WAIT`. `requires_resume` determines the paused state for silent records. Backend `COMPLETE` guidance is distinct from the explicit `/finish` mutation. `useTourSpeech` contains a browser speech helper, but the current tour action flow uses backend audio through `useTourAudioPlayer`.
- Pause/resume send persistent backend controls using duration-zero requests. These requests do not replace the current playable record. Segment start/completion/interruption acknowledgements are serialized. Account/tour-scoped `pg-playback-{user_id}-{tour_id}` recovery records retain segment delivery state and pending request payloads/keys across reloads, and are removed after successful completion. They contain no bearer tokens or audio. Completion calls `/finish` and navigates only on success.
- The backend supports generation history/status, regeneration, cancellation, acceptance, private artifacts, enrichment inspection, and account deletion. Adding screens for these is deferred by user instruction; keep existing tour flows compatible without implying those screens exist.
- The backend supports additional route options (destination, interests, wheelchair routing, stop time) beyond the current UI. Frontend types are handwritten; compare against Python models when extending them.
- Browser authentication, real Mapbox rendering/GPS, and provider-backed speech need valid configuration and interactive verification. Unit tests and a build do not establish end-to-end provider behavior.

## Tests and verification boundaries

Vitest runs in a Node environment with aliases for `~` and `@`; it does not launch Nuxt or a real browser. `tests/setup.ts` stubs auto-imported Vue/Nuxt helpers, storage, and request utilities and creates isolated Pinia state.

| Source                      | Coverage                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/regressions.test.ts` | Shared position mode, missing GPS, text highlighting, transcript reset, accepted voice, silence, empty lists, creation errors, stale profile responses        |
| `tests/auth.test.ts`        | Failed settings-save rollback                                                                                                                                 |
| `tests/client-auth.test.ts` | Token origin boundary and identity changes during token retrieval                                                                                             |
| `tests/proxy.test.ts`       | Missing upstream config, upstream errors, authentication, origin checks, idempotency forwarding, mutation retry policy                                        |
| `tests/playback.test.ts`    | Finish-before-navigation, failed finish, silent audio, persistent pause, safe reload restoration                                                              |
| `tests/audio.test.ts`       | Blocked autoplay and ended events                                                                                                                             |
| `scripts/smoke.mjs`         | SPA response, auth rejection before upstream, proxy mapping, request IDs, idempotency, silent narration, finish, upstream errors against a local HTTP fixture |

For code changes, use the commands in Stack and commands. Run `test:smoke` after `build`; run `test:dev` separately to avoid concurrent `.nuxt` writes. Both smoke modes create temporary local listeners and use a fixture token, so they cannot verify Firebase validation or live provider behavior. For documentation-only changes, review the diff, check referenced paths, and run focused Prettier checks; application builds are unnecessary unless the documented change also changes code or configuration.

## Validation and change discipline

For an API change, trace the browser composable, Nitro handler, forwarding helper, backend endpoint, and Python model together. Check ownership/authentication and response transformations as well as the happy path. Avoid adding direct browser calls to privileged backend/provider APIs.

For UI or playback changes, exercise login/redirect, guide selection, route creation/progress, tour loading, GPS and manual coordinates, play/pause/resume, visitor questions, navigation cleanup, and the affected settings. Include empty/error and silent-response cases relevant to the change. Manual simulation helps test without physical travel; it is not evidence of real GPS behavior.

Keep changes within the requested scope and check each repository's working tree before editing. Do not modify the backend merely to hide a frontend contract mismatch. Do not edit generated `.nuxt/`, `.output/`, or dependency files by hand. Keep this guide current when architecture, commands, environment variables, or contracts change.

Node is installed through NVM. Noninteractive shells may need `source "$HOME/.nvm/nvm.sh"` before using Node/Corepack. See README for local setup. The regression suite uses controlled dependencies; live provider behavior still requires browser testing.

## Current-stop text milestone

`NUXT_PUBLIC_TEXT_EXPERIENCE_ENABLED=true` exposes `CurrentStopExperience`; the backend must also enable `TEXT_EXPERIENCE_ENABLED`. The frontend default is on by explicit user instruction; backend enablement remains separate. `experienceStore` is separate from playback and resets on account/tour changes. It forwards revision and generation identity with an idempotency key; uncertain actions must be retried or explicitly reconciled by reloading. The proxy uses the existing authenticated same-origin API boundary. Personal context is per tour; saving or clearing future preferences is an explicit profile action. No text activity pauses existing audio.

Creation uses the selected suggested variant, preserving named stops separately from route geometry. Changing start/duration invalidates the suggestion. New tours draw their stored geometry directly rather than requesting a second route; legacy tours retain the existing map path. Context form fields are optional. The text feature's Python/client tests do not establish live GPS, provider factual accuracy, field accessibility or public-launch readiness.

User constraint for this milestone: **do not generate, listen to, test or benchmark audio. Existing audio remains in use. Future audio verification MUST receive explicit human approval.** Use focused `tests/experience.test.ts`, `tests/experience-proxy.test.ts`, `tests/tour-contract.test.ts`, `tests/stored-route.test.ts`, `tests/client-auth.test.ts`, and `tests/auth.test.ts`, plus typecheck/build. Audio-inclusive regression/smoke suites are excluded until that approval.

`pnpm test:text` runs the approved nonaudio checks, including text rendering,
saved preferences, per-tour request serialization, GPS clearing and component
rendering. `tests/ui-*.test.ts` adds nonaudio checks for native controls,
notifications, route drafts, map following, catalog states and tour loading.
GPS updates move the user marker; map following requires the visitor's explicit
choice and stops after a map gesture. Text interactions, playback receipts and finish requests share a
client mutation queue because the backend uses one tour lease. Account changes
invalidate queued work. Local audio pause remains available during text requests.
Failed reconciliation keeps the original interaction payload/key until a fresh
state is loaded. Future personal context is hydrated once per new walk without
overwriting draft edits or newer profile saves. Conversation sources are cached
in memory for the current tour/generation; unavailable historical links are
explicitly labeled.

Route preferences now flow through the suggestion proxy (`interests`,
`excluded_topics`, `pace`, `step_free`, `personal_context_enabled`). Preference
edits invalidate prior suggestions and in-flight responses. Creation settings
use the same enabled/excluded-interest rules. Empty suggestions are legitimate
infeasible/unverified-route results and show the backend explanation. Step-free
requests are withheld until whole-path accessibility can be verified.

The text panel displays backend navigation status, provider instructions and
warnings. It never derives turns from stop names. `navigation-display.test.ts`
and `route-preferences-proxy.test.ts` are additional approved nonaudio checks.

## Guide interaction preferences

`shared/types/guideInteraction.ts` and `shared/types/personalContext.ts` own the
interaction contract and legacy defaults, imported with `#shared`. Guide cards
and effective experience modes default to `interactive`; personal context
defaults to `guide`. The selector remains available when personal memories are
disabled. Creation keeps this operational preference while omitting disabled
personal information. Active-tour changes use the full current context through
`UPDATE_CONTEXT`; saving future profile preferences remains explicit.

Display the backend's effective `interaction_mode` separately from the context
selector. `FORGET_CONTEXT` can reset context to `guide` while retaining a
`leading` operational override. Commands through the main tour controls can
advance the text revision even when the remainder of `/next` fails. Their
automatic reconciliation stays inside the shared request queue, retains pending
text payloads/keys, and leaves text mutations blocked if a fresh read fails.
First-send revision capture waits for earlier queue work; retries retain the
original body and generation. Automatic visibility reads also preserve pending
actions; explicit reload reconciles and discards them only after a successful read.

Backend contract edge: `effective_context()` falls back to profile preferences
when the tour context equals all defaults. An explicit all-default `guide`
selection can therefore be indistinguishable from an absent tour preference.
The frontend sends the selected value unchanged; backend presence tracking is
needed to remove that ambiguity.

`tests/guide-interaction*.test.ts` and `tests/experience*-mode*.test.ts` cover
the nonaudio contract and UI. A development-only Next step button beside
Pause/Resume calls the existing next-step action and is removed from production
rendering by `import.meta.dev`. Its audio behavior has not been verified.

## Tour progress display

`TourProgressSummary` displays a read-only summary derived by
`shared/utils/tourProgress.ts` and `useTourProgress`. The fetched tour provides
structured `history` records and saved `experience` state; legacy string history
entries are ignored. Live text state is read through `experienceStore.viewFor`
only for the matching tour and Firebase UID (distinct from the backend's
`tour.user_id`). An uninitialized saved text state falls back to historical
guidance. Guidance stop IDs map to route position;
walking targets and manually selected stops do not establish a physical visit.
The meter reports route position, never a completion percentage. Explicit finish
does not imply every stop was visited.

The composable retains only guide-text/location metadata across empty live
updates and clears it on tour/account changes. It requests no turns, starts no
audio and stores no new browser data. Reload restoration uses existing backend
history. `tests/tour-progress.test.ts` and `tests/ui-tour-progress*.test.ts` are
approved nonaudio checks for derivation, isolation and rendered states.

## Guide objects on the map

`shared/utils/guideMapObjects.ts` derives discussed objects from the latest
nonempty guide reply, response `places` and unambiguous whole route-stop names.
When no explicit subject resolves, story turns with nonempty `fact_ids` and
ARRIVE/CONTINUE/WALK guidance can use their stop ID; operational text turns and ANSWER/LOCATE/WAIT guidance
cannot assume that the visitor's contextual stop is the subject. Legacy replies
without classification/evidence metadata retain stop-ID support. Visitor coordinates are never
object coordinates. Names without known coordinates or exact name matches remain
unhighlighted. Returned places reuse numbered stops only when both name and
coordinates match; distinct co-located objects retain their identities.

`createGuideMapMarkers` retains route elements across discussion changes,
updates amber halos, safe labels and accessible names, removes stale off-route
markers and clears on map replacement/disposal. The legend and caption describe
the current message's objects. Empty updates preserve the last guide message;
a new unresolved message clears its highlights. There is no word/audio timing,
camera movement, extra request or browser persistence. Reload resolves known
route subjects from backend history; response-only `places` are not in saved
history. `tests/ui-guide-map-objects.test.ts` and
`tests/ui-guide-map-markers.test.ts` are approved nonaudio checks in `test:text`.

## Automatic same-stop continuation

The user explicitly enabled both frontend feature flags. `storyBufferEnabled`
and `textExperienceEnabled` default to true; local runtime overrides are
`NUXT_PUBLIC_STORY_BUFFER_ENABLED` and `NUXT_PUBLIC_TEXT_EXPERIENCE_ENABLED`.
Backend flags remain separate. Contract source: the supplied sibling worktree
`.private/worktrees/system-improvement/current_implementation/proposed_tour_generation/story_buffer_contract.md`;
compare its executable `models/story_buffer.py` and `services/story_buffer_service.py`
when changing this integration. A legacy/disabled backend reports unavailable.

`shared/types/storyBuffer.ts` and `shared/utils/storyBuffer.ts` own typed metadata
and control transitions. `useStoryContinuation` samples actual remaining time
while a STARTED segment is active and prepares once at `0 < remaining <= 40`.
GPS must have accuracy <= 50 m, fix age -30..90 seconds and distance plus accuracy
<= 40 m from the same stop. Manual coordinates never become GPS evidence.
Preparation retains the old record, checkpoint, text and map focus. Activation
supplies the explicit completed anchor; backend completes it and activates the
new segment atomically. Only the activated response is adopted by `tourStore`.
Discussion focus is independent of the visitor point. Media is an existing
owner-scoped artifact through `/api/tour-artifacts/*`, never synthesis.

Buffer mutations use the existing per-tour request queue. Metadata GET reads
are scope-fenced and do not block manual controls when no mutation is pending.
Both use the authenticated same-origin proxy. Pause takes effect locally before network
cancellation. Explicit text actions await cancellation without pausing audio.
Visitor actions, GPS uncertainty/movement, preferences, hidden pages, navigation
and account/tour/generation changes suspend continuation. Cancellation epochs
also fence the asynchronous activation handoff. There is no feature-toggle/status
section in the tour UI; continuation defaults on and the main Pause button cancels
it. Each newly STARTED segment can prepare once when 40 seconds remain. Explicit
actions reconcile pending mutations before proceeding; failed reconciliation
shows a retry/reload notification. Pending prepare/activate/cancel metadata is saved under
`pg-story-buffer-{backend_user_id}-{tour_id}-{generation_id}`; it includes GPS
metadata, operation IDs and buffer identity, no tokens, visitor text or media.
Do not copy it into logs. Recovery stays paused and never replays consumed content.
Reconciliation preserves original uncertain request payloads/keys. Startup reads
existing metadata and cancels an old prepared buffer rather than auto-restoring it.

`tests/ui-story-buffer*.test.ts` verifies pure controller transitions, proxy
metadata, map focus and idempotent record adoption without media/player execution.
`tests/ui-tour-narration.test.ts` checks request budgets/modes and conservative GPS
eligibility as pure metadata; the chained controller test checks successive turns
and cancellation on pause.
The browser adapter, recordings, playback timing and live backend behavior are
unqualified; the existing explicit-human-approval audio restriction still applies.

## Development walking screen

In development, `TourReadingPanel` displays the full latest guide message below
playback controls and puts progress in a closed native disclosure beneath it.
Production retains its existing text/progress layout. The Next step handler stops
local movement and invokes the existing explicit-resume action. New narration
requests sample the current active position again after interruption acknowledgement;
uncertain retries still retain their original payloads. No audio behavior has been
tested for this change.

`useRouteWalk` performs local manual simulation in 300-metre increments over
three seconds, using the actual displayed geometry from `useMapboxDirections`.
Stored geometry is used directly; legacy provider precision-five polylines are
decoded by `shared/utils/routeMovement.ts`. Stop coordinates are never substituted
for a missing path. Movement updates the existing marker in place, retains a
cursor across route crossings, caps at the end and honours reduced motion.
Mode/request/route changes, marker gestures and disposal cancel animation. This
control performs no GPS writes or backend requests.

The map shows distinct GPS and simulation markers, numbered route stops, compact
place labels and an outlined stored route. Place popups keep escaped names and
44-pixel controls; clicking one does not relocate the simulation marker.
`tests/ui-route-walk.test.ts`, `tests/ui-simulation-marker.test.ts`,
`tests/ui-tour-reading.test.ts` and `tests/ui-tour-step-location.test.ts` are
additional approved nonaudio checks. Live Mapbox and narration verification
remain separate; the audio restriction above still applies.
