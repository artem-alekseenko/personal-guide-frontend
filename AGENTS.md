# Personal Guide frontend

## Scope and companion backend

This repository is the web frontend for Personal Guide: authenticated, location-aware walking tours with guide selection, route planning, generated narration, maps, audio playback, and user preferences.

The backend is a separate sibling repository at `../personal-guide.ai/` (from this checkout, `/home/abba/startup/personal-guide.ai`). Inspect it when changing API contracts. The parent directory is a workspace containing both repositories.

### Mandatory backend read-only boundary

**Every agent working on a frontend task, including delegated agents and tool-driven scripts, MUST treat the companion backend as read-only.**

- Reading backend code, documentation and API contracts is allowed.
- Do not create, edit, delete or format backend files, or change backend Git state: no staging, commits, resets, checkouts, pulls or pushes.
- Do not run backend tests, builds, migrations, workers, deployments or other commands that can modify backend files, services or persisted data.
- Do not bypass this boundary by changing directories, using `git -C`, SSH, containers, scripts or subagents. Include this restriction explicitly in delegated tasks.
- Backend setup/operation examples elsewhere in this guide are reference material, not permission to execute them. General requests such as “fix the integration” or “commit and push everything” apply only to the frontend checkout.
- If a frontend change requires a backend change, describe the required contract/change and leave its implementation to a separately authorized task started in the backend checkout.

The backend owns Firebase token validation, user and tour ownership, MongoDB persistence, route planning, tour preparation/generation, narration, speech synthesis, and background research. This repository owns the browser UI and a Nuxt server proxy. Keep provider credentials and generation logic on the backend.

Read these backend sources for integration work:

- `../personal-guide.ai/current_implementation/api_reference.md`: endpoint contracts and playback semantics.
- `../personal-guide.ai/current_implementation/architecture.md`: services and data flow.
- `../personal-guide.ai/current_implementation/environment_variables.md`: backend configuration.
- `../personal-guide.ai/current_implementation/setup_and_operations.md`: local operations.
- `../personal-guide.ai/app/main.py`: mounted routers and API prefix.
- `../personal-guide.ai/app/api/v1/endpoints/`: guide, user, and tour handlers.
- `../personal-guide.ai/app/models/`: request/response validation; especially `tour_next_request.py`, `tour.py`, and `language.py`.

Treat executable code as authoritative when documentation and types disagree. The observations below describe source contracts, including the documentation review on 2026-10-11; they do not establish that a live deployment works.

## Stack and commands

The package declares Nuxt 4.6.1, Vue 3.5.44, Pinia 4.1.0 with `@pinia/nuxt` 1.0.3, Nuxt UI 4.11.3, Tailwind CSS 4.3.3, VueUse 15.0, Firebase 13/Admin 14, Nuxt i18n, and Mapbox GL 3.33 with Mapbox Directions. Native TypeScript 7.0.2 runs beside the maintained TypeScript 6 API package required by Vue tooling. It uses ES modules. Nuxt 4.4.4 breaks SPA development with `Vite Node IPC socket path not configured`; use the pinned patched dependency rather than manually setting internal socket environment variables.

- Required Node range: `^24.21.0 || >=26.0.0` in `package.json`; use the pinned Node 24.21.0 LTS release for development. Node 26 is permitted, not recommended over the pinned LTS runtime.
- Package manager: `pnpm@12.11.2`; preserve `pnpm-lock.yaml`. `pnpm-workspace.yaml` owns hoisting, pre/post scripts, exact-version saves, security overrides, version-pinned dependency patches and explicit dependency-build approvals. pnpm 12 reads only auth/registry configuration from `.npmrc`; the obsolete project file was removed. Docker copies the workspace configuration and `patches/` before its frozen install.
- Nuxt DevTools is locked at 3.4.3, which removes `simple-git` and its critical/high advisories without a forced major override. The obsolete Git argument-parser override was removed. The two remaining high registry advisories have local code patches, documented below; do not suppress their audit warnings.
- `pnpm install --frozen-lockfile`: install dependencies; `postinstall` runs `nuxt prepare`.
- `pnpm dev`: development server, normally port 3000.
- `pnpm build`: production build, with Nuxt TypeScript checking enabled.
- `pnpm typecheck`: Nuxt/Vue SFC checking, followed by native TypeScript 7 checking of generated server/shared projects.
- `pnpm test:text`: approved nonaudio Vitest regressions and Node-rendered component checks for the current milestone.
- `pnpm test:smoke`: after a build, exercises Nitro against a local fixture backend (requires local TCP listeners); excluded under the current audio restriction because it exercises the narration contract.
- `pnpm test:dev`: runs the same HTTP checks against a temporary development server; excluded under the current audio restriction. After explicit human approval, run separately from builds because both generate `.nuxt` files.
- `pnpm test`: full Vitest regression suite, including audio tests; excluded under the current audio restriction. `tests/setup.ts` provides Nuxt auto-import globals and isolated Pinia state.
- `pnpm preview`: preview the production build.
- `pnpm generate`: static generation; the application still needs its `/api/*` server handlers, so a static-only host is insufficient for the current architecture.
- `pnpm prettier:check`: repository formatting check.
- `pnpm exec prettier --check AGENTS.md`: example of a focused formatting check.
- `pnpm prettier`: formats the entire repository; prefer formatting changed files to avoid unrelated churn.

Regression tests cover stores, proxy behavior, authentication boundaries, playback controls, and audio events. There is no ESLint configuration or CI workflow. For current code changes, use the approved nonaudio `test:text`, type checking, a build, and relevant formatting checks, then exercise only the affected nonaudio browser flow with the backend available. Do not generate, listen to, test, or benchmark audio without explicit human approval; the full test and default smoke commands are not part of current verification.

`docker-compose.yml` builds the frontend service `proto`, reads `.env`, and publishes port 3000. The Dockerfile builds Nuxt and starts the generated Nitro server. It uses Node 24.21.0, installs from the lockfile, passes public Firebase/Mapbox build arguments through Compose, and runs the production server as the node user. `.dockerignore` excludes local secrets and generated output. `.nvmrc` selects the exact Node 24.21.0 release. If pnpm is not installed globally, use `corepack pnpm` with your NVM Node environment.

The backend's separate Compose stack publishes the API on port 3001 and MongoDB on host port 27018. It includes bootstrap plus generation, enrichment, and account-deletion workers. The generation worker handles queued tour preparation; there is no separate preparation-worker service in the current Compose stack. Follow its setup documentation and executable Compose configuration; running only an API process does not perform queued preparation. Its business routes have no version prefix by default (`API_V1_STR=""`).

## Local setup

Run from this repository:

```sh
source "$HOME/.nvm/nvm.sh"
nvm install v24.21.0 --latest-npm
nvm use v24.21.0
corepack pnpm install --frozen-lockfile
# Create .env from .env.example only if .env does not already exist.
corepack pnpm dev
```

Before starting the app, configure `.env` as described below and start the backend and its workers using the sibling repository's setup guide. Do not overwrite an existing `.env`. The frontend needs no local MongoDB connection; it reaches persistence through the backend. `pnpm-workspace.yaml` enables hoisting and pre/post scripts. Preserve these settings when investigating dependency or Nuxt auto-import failures.

The user explicitly approved the latest-major frontend migration. Firebase 13
uses the native SDK through `app/plugins/00-firebase.client.ts`; VueFire,
nuxt-vuefire and their app-types peer are removed rather than overriding
unsupported peer ranges. Existing `VUEFIRE_*` environment names remain the public
Firebase configuration inputs. Firebase Admin is 14.5.0.

TypeScript follows the [official side-by-side layout](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/):
`@typescript/native` aliases TypeScript 7.0.2 (`tsc`), while `typescript` aliases
`@typescript/typescript6` 6.0.2 (`tsc6`, currently using the 6.0.3 API).
`vue-tsc` still requires that JS API; do not point it at native 7 or disable SFC
checking. `pnpm typecheck` exercises both toolchains. Node types remain on the
latest Node 24 line to match the pinned runtime. Nuxt UI's Tiptap peers are pinned
together at 3.32.0, with y-tiptap 3.0.10. Exact release-age exclusions recorded by
pnpm stay scoped to the requested logos/Vitest patches. Dependency upgrades do
not authorize backend changes, live Firebase sign-in, paid providers or audio checks.

### Dependency security patches

`pnpm-workspace.yaml` registers exact-version patches in `patches/`.
`node-forge@1.4.0.patch` backports the proposed
[forge#1152 fix](https://github.com/digitalbazaar/forge/pull/1152) for
CVE-2026-85393: RSA DigestInfo validation checks the nested algorithm element
count as well as the outer sequence. `braces@3.0.3.patch` addresses
CVE-2026-93687 by bounding parsed brace/parenthesis nesting to 100 and guarding
compile/expand/stringify recursion for callers supplying ASTs directly.
Excessive nesting raises a controlled SyntaxError; escaped/quoted literals and
supported nesting retain their existing behavior.

No patched registry releases exist as of 2026-10-15. `pnpm audit` still reports
the original versions and two high advisories; this is not a zero-advisory audit.
Do not rename packages, change version labels or ignore findings to hide them.
Replace these local patches with verified upstream releases when available.
`tests/ui-dependency-security.test.ts` has public-only RSA vectors and brace
boundary regressions in the approved nonaudio suite. Real Node consumer smoke
passed on the host and in an offline container after a frozen install.
Docker must copy `patches/` before installing; `.private` staging/probe material
is excluded from the build context. No backend, provider, sign-in or audio
execution is required to verify these patches.

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

1. `app/plugins/00-firebase.client.ts` initializes the native Firebase SDK before API/profile plugins and provides a shared shallow-readonly `$firebaseUser` ref. Its auth observer is removed on app unmount/HMR. Auth actions include email/password registration and login, and Google popup login. Optional App Check retains the Enterprise provider, development debug flag and token auto-refresh.
2. `app/middleware/auth.global.ts` waits for `auth.authStateReady()` before redirecting unauthenticated private-page requests to `/` with a `next` query. Authenticated visitors normally enter `/tours`; pages can declare `meta.public`. Auth actions, the middleware and login page share `resolveAuthRedirect` from `app/utils/navigation.ts`, rejecting protocol-relative URLs, backslashes and line breaks. `tests/ui-firebase-auth.test.ts` covers restored-account versus anonymous navigation during initialization.
3. `app/plugins/01-api-fetch.client.ts` provides `$apiFetch`, adding the current Firebase ID token to `/api/*` requests. Use this authenticated client in API composables.
4. `server/middleware/require-auth.ts` requires a nonempty Bearer header for private `/api/*` requests. It checks header presence, not token validity. `/api/health` and `/api/public` prefixes are exempt, but the checkout does not implement matching handlers.
5. The client attaches tokens only to same-origin `/api/` requests, shares concurrent token retrieval for the same UID, and rejects a request if the identity changes while awaiting its token. Preserve this boundary when adding API clients.
6. `useExternalApi` delegates to `forwardAuthAndFetch`, which forwards Authorization and an incoming or generated `X-Request-ID`. The backend validates the token and enforces ownership.

The proxy defaults to a 120-second timeout, one retry for reads, and no automatic retry for mutations. It forwards `Idempotency-Key` for narration retries. When a base URL is configured, it rejects upstream URLs from other origins. Keep upstream API URLs private. Do not log credentials, profile bodies, or visitor messages.

Tour API identifiers are encoded as individual path segments in browser clients
and proxy handlers; a decoded route parameter must not select a different API
endpoint.

## Endpoint mapping and environment

Copy `.env.example` to a local ignored `.env` and fill in the public Firebase and Mapbox configuration. Endpoint-specific variables are optional because the handlers default to the sibling backend's paths. These are example paths for the default backend routing, not production configuration:

| Frontend endpoint                                                     | Backend endpoint                                                                                | Environment variable                                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GET /api/guides`                                                     | `GET /guides/`                                                                                  | `PG_API_GUIDES_URL=/guides/`                                                               |
| `GET /api/route-suggestions`                                          | `GET /guides/route_suggestions/{guideId}`                                                       | `PG_API_ROUTE_SUGGESTION_URL=/guides/route_suggestions/`                                   |
| `POST /api/create-tour`                                               | `POST /tours/`                                                                                  | `PG_API_CREATE_ROUTE_URL=/tours/`                                                          |
| `GET /api/list-tours`                                                 | `GET /tours/`                                                                                   | `PG_API_LIST_TOURS_URL=/tours/`                                                            |
| `GET /api/get-tour/{tourId}`                                          | `GET /tours/{tourId}`                                                                           | Reuses `PG_API_LIST_TOURS_URL`                                                             |
| `POST /api/get-tour-record/{tourId}`                                  | `POST /tours/{tourId}/next`                                                                     | Reuses `PG_API_CREATE_ROUTE_URL`                                                           |
| `GET /api/user-profile`                                               | `GET /users/me/`                                                                                | `PG_API_GET_ME=/users/me/`                                                                 |
| `POST /api/finish-tour/{tourId}`                                      | `POST /tours/{tourId}/finish`                                                                   | Reuses `PG_API_CREATE_ROUTE_URL`                                                           |
| `PUT /api/user-profile`                                               | `PUT /users/me/`                                                                                | `PG_API_UPDATE_ME=/users/me/`                                                              |
| `POST /api/research-preview/{tourId}`                                 | `POST /tours/{tourId}/research-preview`                                                         | Reuses `PG_API_LIST_TOURS_URL`                                                             |
| `GET /api/tour-generations/{tourId}`                                  | `GET /tours/{tourId}/generations`                                                               | Reuses `PG_API_LIST_TOURS_URL`                                                             |
| `GET /api/tour-generations/{tourId}/{generationId}`                   | `GET /tours/{tourId}/generations/{generationId}`                                                | Reuses `PG_API_LIST_TOURS_URL`                                                             |
| `POST /api/tour-generations/{tourId}/{generationId}/progress-message` | `POST /tours/{tourId}/generations/{generationId}/progress-message`                              | Reuses `PG_API_LIST_TOURS_URL`; idempotent status wording, not a factual progress mutation |
| `POST /api/tour-generations/{tourId}/{generationId}/{action}`         | `POST /tours/{tourId}/generations/{generationId}/{action}` (`cancel`, `finish-early`, `accept`) | Reuses `PG_API_LIST_TOURS_URL`                                                             |
| `POST /api/tour-regenerate/{tourId}`                                  | `POST /tours/{tourId}/regenerate`                                                               | Reuses `PG_API_LIST_TOURS_URL`                                                             |
| `GET /api/tour-research/{tourId}`                                     | `GET /tours/{tourId}/research`                                                                  | Reuses `PG_API_LIST_TOURS_URL`                                                             |
| `GET /api/tour-enrichment/{tourId}`                                   | `GET /tours/{tourId}/enrichment`                                                                | Reuses `PG_API_LIST_TOURS_URL`                                                             |
| `GET /api/research-artifacts/{tourId}/{artifactId}`                   | `GET /tours/{tourId}/artifacts/{artifactId}` (JSON/text only)                                   | Reuses `PG_API_LIST_TOURS_URL`                                                             |

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
- Route suggestions validate bounds and translate `lat`/`lng` into `curr_lat`/`curr_lng`; the proxy initially derives map coordinates from the first route. Selecting another variant replaces those coordinates with its geometry. Creation sends the selected variant's named stops, separate route geometry, `guide_id`, personal context, and enabled selected tags as `{ name, value }` settings.
- Guide and tour list proxies unwrap `{ guides }` and `{ tours }` into arrays. `useGetTourRecord` combines `record` with response-level `places`, `audio_data`, and `route_points`. The tour store applies returned route points to the active route.
- `routeStore` polls lists every five seconds while any preparation snapshot is `PENDING`/`RUNNING`, even on a `STARTED` tour. Without a snapshot it falls back to status `GENERATING` without a preparation error. It retries list failures on the same schedule. The list page stops polling on exit, restores polling on reentry even during an unfinished read, and distinguishes loading, empty, and failed states.
- `tourStore` owns narration text, active audio identity and visitor questions. New narration always requests a complete supported response and omits legacy duration/style hints. Questions never select SHORT. Duration-zero controls remain silent. New replies have at most four complete sentences, including qualifications. New story metadata carries requires_explicit_continue and narration_policy_version=location-four-v1; multipart remainders require another explicit request. Historical offered records are never truncated by the frontend. Historical multipart metadata, active audio and uncertain operations keep their original content, payloads and keys. Reliable near-stop GPS can select STATIONARY; otherwise WALKING does not claim arrival. Manual coordinates never acquire GPS metadata. Backend evidence and geographic scope determine eligibility; definitive input/auth rejections discard pending operations.
- `useTourState` saves state/audio position under `tour-state-{tourId}` with a 24-hour expiry. Audio resume rewinds five seconds. Active-record recovery also uses read-only story-buffer metadata and existing audio. Restored/generated audio remains paused; reload does not acknowledge completion.
- `useTourAudioPlayer` plays base64 audio through an HTML audio element and estimates text highlighting from playback progress. Clean up object URLs, audio, Mapbox objects/listeners, timers, and geolocation watchers when modifying lifecycle code.
- GPS is the default position mode; manual mode uses a draggable simulation marker. `usePositionMode` shares the choice through Nuxt state and persists it under `tour-position-mode`. Missing GPS must not fall back to a landmark; route-point fallback is for manual simulation only. Maps initialize even if location permission is denied.
- `userStore` keeps guest language under `personal-guide-user-lang`. The preferences plugin loads the backend profile after authentication. The update proxy forwards `name`, `language`, and `personal_context` when explicitly supplied; voice choice persists locally under `personal-guide-voice`. Statistics remain hidden until populated. Firebase identity changes reset owner-specific tour/guide state and invalidate in-flight responses.

## State, preferences, and navigation

- `guidesStore` holds the guide catalog and selected guide in memory with a one-hour cache TTL. Catalog responses include owner-specific tours; do not restore the old persistent guide cache. Creation redirects to `/guides` when no guide is selected.
- `routeStore` owns the start point, duration, suggested route variants and selection, tags, newly created tour, and tour list. Creation uses the selected suggested variant and navigates to `/tours` after success. Its shared `isCreating` lock survives page remounts and rejects concurrent submissions. A successful response consumes only the unchanged submitted draft; later edits remain available. Request versions and account epochs prevent stale responses from repopulating reset stores or releasing another account's creation lock.
- `tourStore` owns the active tour, playable record, accumulated transcript, pending visitor message, and playback recovery. Switching tours resets transcript and playback state. `useTourActions` coordinates requests, audio, acknowledgements, and completion; keep page event handlers thin.
- `geolocationStore` owns coordinates, accuracy, ISO fix timestamp, and the browser watch. The client plugin initializes location at startup and stops the watch on unload. Geolocation requests use high accuracy with a ten-second timeout; permission denial fails without retrying, while timeout/unavailable errors allow up to three retries.
- `useAuth.updateUserPreferences` applies settings locally and sends a profile update when language changes. Failed saves restore previous preferences if the same user remains signed in. `SettingsSavingOverlay` covers pending saves. Voice/model-only changes remain local.
- Model type is selectable in Settings (`DEFAULT`, `SIMPLE`, `OPENAI`, `OPENAI_MINI`, `OPENAI_FULL`, `GEMINI`, `MOCK`, `PERPLEXITY`, matching backend `TypeLLm`). New narration/control requests include the selection as `type_llm`; uncertain retries retain their original model and payload. Changing the selection does not request narration. Reset settings restores English and `DEFAULT` voice/model. `OPENAI_MINI` and `OPENAI_FULL` resolve through backend `OPENAI_MINI_MODEL` and `OPENAI_FULL_MODEL`; keep configurable model version names out of frontend labels. Enum support does not establish that a provider has working credentials.
- `settings-navigation.global.ts` remembers the entry route. `useBackNavigation` maintains up to ten prior local paths, excludes login/settings entries, and clears history and settings return state on every UID change, including direct account switches. Stored JSON is UID-scoped (`{ uid, paths }` and `{ uid, path }`); ownerless legacy history and mismatched owners are discarded. Invalid path entries are filtered. Storage failures retain in-memory/browser navigation rather than crashing the app. Preserve return-to-tour behavior when editing settings navigation.

Browser storage reference:

| Key                                   | Storage | Purpose and lifetime                                                                                          |
| ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `personal-guide-user-lang`            | Local   | Language fallback; backend profile can replace it after login                                                 |
| `personal-guide-voice`                | Local   | Device voice preference                                                                                       |
| `personal-guide-llm`                  | Local   | Device model preference                                                                                       |
| `tour-position-mode`                  | Local   | Shared GPS/manual choice                                                                                      |
| `tour-state-{tourId}`                 | Local   | UI state and audio position; expires after 24 hours and needs matching in-memory audio                        |
| `pg-playback-{user_id}-{tour_id}`     | Local   | Segment checkpoint and pending narration/control payloads and operation keys; removed after successful finish |
| `navigationHistory`                   | Local   | UID-scoped JSON `{ uid, paths }`; up to ten safe local back-navigation entries                                |
| `settingsReturnRoute`                 | Session | UID-scoped JSON `{ uid, path }`; safe route to return to from settings                                        |
| `pg-preparation-caption-{JSON scope}` | Session | Pending caption generation/body/key; scoped to Firebase UID, backend owner and tour; no tokens/media          |
| `i18n_redirected`                     | Cookie  | Locale selection                                                                                              |

Playback recovery can include location and pending visitor text. It contains no bearer token or audio; do not copy it into logs or diagnostics without redaction. The preferences plugin clears `tour-state-*` and obsolete `pg-guides-*` cache keys on UID changes. Account-scoped playback recovery survives reloads separately from UI/audio state; do not conflate their lifetimes.

## Playback and remaining product scope

- Supported languages are English and Russian, matching the backend `Language` enum. French translation files alone do not establish backend narration support.
- Voice choices are `DEFAULT`, `CARTESIA`, and `MOCK`; default selection delegates to backend configuration. MOCK means sample audio, not generated speech or browser TTS. Real speech requires a configured backend provider.
- The tour page handles nullable audio and intentional `WAIT` responses without appending empty text or starting playback. Text highlighting uses shared state. Autoplay rejection leaves a Play action available.
- Narration is request-driven. The main button starts/continues narration, pauses active audio, or resumes a paused segment. Visitor questions request a new turn. Dragging the simulation marker requests a turn only in `RECORD_FINISHED`. GPS watches update position; automatic continuation observes that evidence and actual remaining time. Audio completion acknowledges the segment. Automatic same-stop continuation uses the story-buffer contract when available and a serialized completion fallback otherwise, as described below. The map's route timer only retries route rendering.
- `useTourActions.isBusy` blocks overlapping user actions. `onAudioEnded` sends `COMPLETED`; starting another turn or finishing interrupts an unfinished segment. `dispose()` stops local audio and ignores late UI work. Do not assume browser unload can deliver an acknowledgement; preserve durable recovery.
- Backend guidance actions include `ARRIVE`, `CONTINUE`, `WALK`, `ANSWER`, `LOCATE`, `COMPLETE`, and `WAIT`. `requires_resume` determines the paused state for silent records. Backend `COMPLETE` guidance is distinct from the explicit `/finish` mutation. `useTourSpeech` contains a browser speech helper, but the current tour action flow uses backend audio through `useTourAudioPlayer`.
- Pause/resume send persistent backend controls using duration-zero requests. These requests do not replace the current playable record. Segment start/completion/interruption acknowledgements are serialized. Account/tour-scoped `pg-playback-{user_id}-{tour_id}` recovery records retain segment delivery state and pending request payloads/keys across reloads, and are removed after successful completion. They contain no bearer tokens or audio. Completion calls `/finish` and navigates only on success.
- The tour research panel supports generation history/status, finish-early, cancellation, regeneration, normal acceptance, private JSON/text research downloads and enrichment inspection. Account-deletion screens remain deferred. Background enrichment has no cancellation endpoint; cancelling a selected preparation generation must not imply otherwise.
- The UI already forwards interests, exclusions, pace, and step-free preferences. Additional backend route options (destination coordinates, a separate wheelchair routing flag, and stop time) remain outside the current UI. Frontend types are handwritten; compare against Python models when extending them.
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

For current code changes, use `test:text`, typecheck, build and focused formatting checks from Stack and commands. The full `test` suite and both default smoke modes remain excluded under the explicit audio restriction. After human approval, run `test:smoke` after `build` and `test:dev` separately to avoid concurrent `.nuxt` writes. Both smoke modes create temporary local listeners and use a fixture token, so they cannot verify Firebase validation or live provider behavior. For documentation-only changes, check referenced paths and use focused Prettier checks; application builds are unnecessary unless the documented change also changes code or configuration.

## Validation and change discipline

For an API change, trace the browser composable, Nitro handler, forwarding helper, backend endpoint, and Python model together. Check ownership/authentication and response transformations as well as the happy path. Avoid adding direct browser calls to privileged backend/provider APIs.

For UI changes, exercise the affected nonaudio login/redirect, guide selection, route creation/progress, tour loading, GPS/manual coordinates, navigation cleanup, text interactions, and settings flows. Include relevant empty/error and silent-response metadata cases without media/player execution. Playback, play/pause/resume, audio visitor questions, and audio verification require explicit human approval. Manual simulation helps check nonaudio behavior without physical travel; it is not evidence of real GPS behavior.

Keep changes within the requested scope and check the frontend working tree before editing. The companion backend is read-only under the boundary above; do not modify it to resolve contract mismatches or include it in frontend commit/push operations. Do not edit generated `.nuxt/`, `.output/`, or dependency files by hand. Keep this guide current when architecture, commands, environment variables, or contracts change.

Node is installed through NVM. Noninteractive shells may need `source "$HOME/.nvm/nvm.sh"` before using Node/Corepack. See README for local setup. The regression suite uses controlled dependencies; live provider behavior still requires browser testing.

## Current-stop text milestone

`NUXT_PUBLIC_TEXT_EXPERIENCE_ENABLED=true` exposes the standalone `CurrentStopExperience` question composer; the backend must also enable `TEXT_EXPERIENCE_ENABLED` and support `ASK_GENERAL`. The frontend default is on by explicit user instruction; backend enablement remains separate. `experienceStore` is separate from playback and resets on account/tour changes. It forwards revision and generation identity with an idempotency key; uncertain questions must be retried or explicitly reconciled by reloading. The proxy uses the existing authenticated same-origin API boundary. Tour preferences are configured during creation; the question composer has no heading, place selector, personal-context editor or activity controls. Text questions do not pause existing audio.

Creation uses the selected suggested variant, preserving named stops separately from route geometry. Changing start/duration invalidates the suggestion. New tours draw their stored geometry directly rather than requesting a second route; legacy tours retain the existing map path. Context form fields are optional. The text feature's Python/client tests do not establish live GPS, provider factual accuracy, field accessibility or public-launch readiness.

User constraint for this milestone: **do not generate, listen to, test or benchmark audio. Existing audio remains in use. Future audio verification MUST receive explicit human approval.** Use focused `tests/experience.test.ts`, `tests/experience-proxy.test.ts`, `tests/tour-contract.test.ts`, `tests/stored-route.test.ts`, `tests/client-auth.test.ts`, and `tests/auth.test.ts`, plus typecheck/build. Audio-inclusive regression/smoke suites are excluded until that approval.

`pnpm test:text` runs the approved nonaudio checks, including text rendering,
saved preferences, per-tour request serialization and component
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
preferences are forwarded, but the backend withholds route variants until
whole-path accessibility can be verified.

The question composer sends `ASK_GENERAL`, text and the selected model, without
stop, mapped-subject or GPS fields. General answers use ordinary model knowledge,
not checked tour evidence; new turns have `kind: "conversation"` and no factual
delivery/source IDs. Historical source links retain their existing safe rendering.
Conversation-kind replies are excluded from speech/progress/map-subject derivation.
Owner/tour/generation scope, the shared mutation queue and original-key recovery
remain. The updated backend is required; there is no place-selection fallback.
`route-preferences-proxy.test.ts` remains an approved nonaudio route-preference check.

## Guide discovery

`GuideCatalog` and `GuideFilters` keep discovery on `/guides`: case-insensitive
search across names, profiles, expertise and tags combines with guide-style and
topic filters. Topics come from real catalog tags, with blank/duplicate labels
removed. Filters are local view state, not extra API requests or browser storage.
Loading, unavailable, empty-catalog and zero-match states remain distinct.

`PGGuide` shows the starting interaction style, a compact profile, safe portrait
fallback and an explicit current-guide label. Native details expand the full
profile and owner-specific saved tours; they do not select a guide or reset the
route draft. Only the named planning button resets the draft, selects the current
guide prop and navigates to `/create-route`. Planning can still override the style.
Cards and filters use theme tokens, keyboard focus and reduced-motion support.

`tests/ui-guides.test.ts` and `tests/ui-guide-card.test.ts` cover composed
discovery, draft isolation, selection, image recovery and plain-text escaping.
The Node renderer retains compiler-generated static HTML as an opaque host node;
browser verification remains necessary for layout and native disclosure behavior.
Guide browser smoke uses actual components, Pinia and router with catalog fixtures;
it does not establish Firebase authentication, live guide availability or audio.

## Guide interaction preferences

`shared/types/guideInteraction.ts` and `shared/types/personalContext.ts` own the
interaction contract and legacy defaults, imported with `#shared`. Guide cards
and effective experience modes default to `interactive`; personal context
defaults to `guide`. The creation selector remains available when personal memories
are disabled. It offers Introvert (`leading`) and Extravert (`interactive`);
inherited `guide` preferences display the selected guide's effective style until changed.
The walk preferences form omits free-text purpose, known-topic and note fields;
existing saved values remain intact. Creation keeps this operational preference while omitting disabled
personal information. Active-tour text questions retain backend context without
showing preference editors, style diagnostics or activity buttons.

Backend `FORGET_CONTEXT` can reset context to `guide` while retaining a `leading`
operational override. Commands through the main tour controls can
advance the text revision even when the remainder of `/next` fails. Their
automatic reconciliation stays inside the shared request queue, retains pending
text payloads/keys, and leaves text mutations blocked if a fresh read fails.
First-send revision capture waits for earlier queue work; retries retain the
original body and generation. Automatic visibility reads also preserve pending
actions; explicit reload reconciles and discards them only after a successful read.

Backend contract edge: when no explicit experience context exists,
`effective_context()` falls back to profile preferences if the tour's personal
context equals all defaults. An all-default `guide` choice at creation can
therefore be indistinguishable from an absent tour preference. An active-tour
`UPDATE_CONTEXT` persists explicit experience context and takes precedence.
The frontend sends the selected value unchanged; backend presence tracking is
needed to remove the creation-time ambiguity.

`tests/guide-interaction*.test.ts` and `tests/experience*-mode*.test.ts` cover
the nonaudio preference contract; `tests/experience-question-ui.test.ts` covers
question drafts, recovery and account/generation isolation. A development-only
Next step button beside Pause/Resume calls the existing next-step action and is removed from production
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

## Map appearance and controls

`app/utils/mapAppearance.ts` owns concrete light/dark palettes shared by Standard
configuration, route paint and map-scoped CSS variables. `BaseMap` follows Nuxt
color mode through configuration updates, never a theme-driven `setStyle`.
Road/place labels remain visible; generic POI/transit labels stay hidden.
Creation and walking maps default to zero pitch. Explicit 3D exploration enables
buildings/landmarks at 40 degrees without changing center, zoom or bearing; trees
and detailed facades remain off. Returning to flat disables 3D objects.

Follow controls require usable GPS. Whole route fits displayed geometry with
control/attribution padding and stops GPS following. Both actions and 3D transitions
respect reduced motion. Theme changes preserve camera and marker identity.
Creation and tour markers share numbered, 44-pixel landmark buttons with bounded
labels on discussion, hover, focus or selection. Popups retain escaped names,
keyboard activation, themed focus/close controls and map-click isolation.

`storedRoute.ts` renders zoom-dependent outlined routes in Standard's top slot.
Legacy decoded Directions geometry uses the same overlay; the plugin's supported
styles option hides its duplicate routes/endpoints. `useMapboxDirections` owns
appearance/style/idle handlers and restores cached geometry without routing or
fitting, including when style readiness follows `style.load`. Cleanup removes
listeners and controls and fences obsolete provider clients.
`tests/ui-map.test.ts`, `tests/ui-map-route-appearance.test.ts`,
`tests/stored-route.test.ts` and marker regressions are approved nonaudio checks.
Real Standard rendering was smoke-checked with software WebGL, mobile/desktop
viewports, both themes and isolated GPS/legacy-route metadata. This does not
qualify live GPS/Directions, physical-device performance, authentication or audio.

## Automatic same-stop continuation

The user explicitly enabled both frontend feature flags. `storyBufferEnabled`
and `textExperienceEnabled` default to true; local runtime overrides are
`NUXT_PUBLIC_STORY_BUFFER_ENABLED` and `NUXT_PUBLIC_TEXT_EXPERIENCE_ENABLED`.
Contract sources are the sibling backend's `app/models/story_buffer.py`,
`app/services/story_buffer_service.py` and mounted story-buffer API. The proxy
maps `/api/story-buffer/{tourId}` to `/tours/{tourId}/story-buffer` and its
prepare/activate/cancel subroutes.

`shared/types/storyBuffer.ts` and `shared/utils/storyBuffer.ts` own typed metadata
and control transitions. Complete single-chunk responses do not arm continuation;
active playback recovery remains available. For compatible historical multipart
records, `useStoryContinuation` samples actual remaining time
while a STARTED segment is active and prepares once at `0 < remaining <= 40`.
GPS must have accuracy <= 50 m and fix age -30..90 seconds. The backend owns actual
route/evidence-scope eligibility at preparation and activation; walking narration
must not be gated on standing within 40 metres of a stop. Explicit manual mode
sends the selected point and null GPS metadata without proving real arrival.
Buffering requires a pinned `playback_generation_id`. Only an explicit proxy
`unsupported_backend` capability response enables `shared/utils/tourContinuation.ts`; supported endpoints and
domain/auth 404/403 failures never enable a parallel completion scheduler.
The fallback requests one new turn after actual completion, never during active
speech. A silent response ends that chain without polling.

Preparation retains the current record/checkpoint/text. Activation supplies the
completed anchor and adopts `view.record`, `view.audio_data` or its existing
owner-scoped recording artifact. Story metadata uses a zero-based chunk index;
the status panel displays one-based part progress and whole-story sentence count.
Discussion subjects are not the visitor's coordinates.

All empty responses, including old completed /next receipts without
`playback_block`, can recover through scoped GET metadata `active_record` and
`active_audio_data`. No new narration POST or completion receipt is sent merely
to recover the GENERATED/STARTED owner. The status panel omits complete-story and
active-audio notices and its separate resume button. Uncertain narration is
resolved with its original key/body before an explicit new visitor request.

Buffer mutations use the existing per-tour request queue. Metadata GET reads
are scope-fenced and do not block manual controls when no mutation is pending.
Both use the authenticated same-origin proxy. Pause takes effect locally before network
cancellation. Explicit text actions await cancellation without pausing audio.
Visitor actions, GPS uncertainty/movement, preferences, hidden pages, navigation
and account/tour/generation changes suspend continuation. Cancellation epochs
also fence the asynchronous activation handoff. `TourNarrationStatus` presents
chunk progress and honest no-content/buffer reasons. The walking screen omits
the duration selector and static narration-mode/interruption explanations.
Continuation defaults on and the main Pause button cancels it. Each newly STARTED
segment can prepare once when 40 seconds remain. Explicit
actions reconcile pending mutations before proceeding; failed reconciliation
shows a retry/reload notification. Pending prepare/activate/cancel metadata is saved under
`pg-story-buffer-{backend_user_id}-{tour_id}-{generation_id}`; it includes GPS
metadata, operation IDs and buffer identity, no tokens, visitor text or media.
Do not copy it into logs. Recovery stays paused and never replays consumed content.
Reconciliation preserves original uncertain request payloads/keys. Startup reads
existing metadata and cancels an old prepared buffer rather than auto-restoring it.

`tests/ui-story-buffer*.test.ts` verifies pure controller transitions, proxy
metadata, map focus and idempotent record adoption without media/player execution.
`tests/ui-tour-narration.test.ts` checks request budgets/modes, conservative GPS
eligibility, commentary-range walking and simulation without media/player
execution; the chained controller test checks successive turns and cancellation
on pause.
The browser adapter, recordings, playback timing and live backend behavior are
unqualified; the existing explicit-human-approval audio restriction still applies.

`app/utils/tourControls.ts` keeps Pause available during pending STARTED receipts
and permits resuming only the record actually loaded by the player. Local pause is
immediate; persistent controls remain serialized. Pure control and continuation
tests run without media/player execution.

Tour creation selects its starting point by map click or a draggable visible marker,
without coordinate inputs, a current-location button or a GPS marker. Duration uses
a native range input with localized label and minutes. Creation drafts and settings
controls are disabled/inert during submission; context edits use a draft revision
so responses cannot overwrite newer typing. List proxies retrieve explicit backend
pages (100 items per page), deduplicate IDs and reject incomplete or nonadvancing
reads rather than presenting a silently truncated list. Nullable guides render an
unavailable-guide label. Suggestion revisions are independent of owner-scoped list
and create requests, and preference rollbacks only restore unchanged submitted fields.

## Walking screen layout

The walking screen puts the map, main playback controls and guide speech before
secondary tools. Questions use a rounded, theme-aware textarea and Ask button,
without an Ask in text heading, place labels, selector or surrounding section card.
Replies and conditional recovery controls remain available. The former
text-exploration panel, Location settings and Public surroundings disclosure
(including its one-shot GPS/public-research controls) are removed. Map location
and discovery behavior are unchanged. Tour research and production progress
remain closed native disclosures. Components stay mounted to preserve pending
operations and drafts. Active preparation stays above the map;
terminal snapshots move into tour research. Experimental-draft warnings remain
visible. The map legend still reflects the existing GPS/simulation mode.

`TourLocationMode` restores an always-visible, keyboard-accessible Real GPS /
Simulation selector beneath the map, without restoring the removed location
settings disclosure. It binds the existing persisted `usePositionMode` state.
Both modes show a person icon: blue/circular for GPS, purple/square for simulation.
`useSimulationMarker` owns mode-driven creation/removal and initializes restored
manual mode even without GPS, using the supplied GPS/route seed or map center.
Dragging and map-click placement keep real GPS untouched; switching sources does
not move the camera. Browser smoke used actual Mapbox with synthetic GPS,
GPS-denied reloads, keyboard switching, English/Russian, mobile/desktop and dark
mode. Authentication, physical GPS and audio were not exercised.

In development, `TourReadingPanel` displays a short latest-guide-text preview below
playback controls. Its closed native disclosure reveals the full text on click;
progress stays in a separate closed disclosure beneath it.
Movement controls and simulation hints appear only in manual mode. The Next step
handler stops local movement and invokes the existing explicit-resume action.
New narration requests sample the current active position again after interruption
acknowledgement; uncertain retries still retain their original payloads.
The layout was browser-checked with isolated nonaudio metadata at narrow/mobile
and desktop sizes, including Russian and dark mode. The map was a layout placeholder;
live authentication, Mapbox and audio were not exercised.

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

## Live preparation progress

`TourWithGuide.preparation_progress` supplies optional owner-scoped list/get
snapshots. `useTourPreparationProgress` also reads the latest requested generation
with `lang` and `message_variant`, independently of playback. Visible cards and
the detail view refresh every five seconds while preparation is PENDING/RUNNING;
hidden/offscreen cards suspend their reads. Tour/account/generation/language
fences reject late work. Read failures retain measured values and show a warning.
Terminal snapshots stop polling and the active-research spinner.

`TourPreparationProgress` displays API `percent` as a stage-weighted estimate,
not elapsed-time completion or story availability. The usePreparationPercent
composable animates increases toward each recorded target in one-percentage-point
steps every 80 ms; it never advances beyond the target or reaches 100 before
READY. Initial/restored snapshots and generation changes adopt their recorded
value; failures, cancellation, corrected lower targets and unknown values stop
animation immediately. VueUse's reduced-motion preference bypasses animation,
and watcher cleanup disposes timers. Missing percent stays unknown. `elapsed_seconds` is time since the generation was queued, rendered
as HH:MM:SS; terminal snapshots freeze it. `remaining_time_kind` distinguishes
an estimate from a current-stage deadline, unknown time and ended processing.
The current backend produces a deadline or unknown, not a reliable finish ETA.
Completed and skipped research stay separate, including immutable preview gaps.
Retained findings, words and archive bytes are not independent factual approval.
Source/action counters include retries and may grow before saved findings exist.

Compact cards keep stage, percentage, timing and current activity visible.
Secondary status, per-stop counters and USD-micro spend/reservations use the
native research disclosure. The stop-and-try action is above the progress panel.
Spinners respect reduced motion. `rich_progress_enabled: false` keeps basic
stage/percentage display and suppresses enhanced UI and paid caption requests;
the backend's `RICH_PROGRESS_ENABLED` defaults to true.

`POST .../progress-message` accepts only `lang`, bounded `message_variant` and
optional `previous_activity_text` (280 characters) with an Idempotency-Key.
The backend's exact Nano status role can incur provider costs; it is not a read
or narration request. Model/fallback/recorded provenance is visible. Caption
responses only replace matching wording, never measured values from newer GET
snapshots. Recorded/fallback wording refreshes with localized GETs; matching
model wording survives source/list updates. Uncertain requests keep the original
key/body across remounts and session reloads, including language/generation changes,
until explicitly reconciled. `preparationMessageStore` uses UID/backend-owner/tour
scopes and `pg-preparation-caption-{JSON scope}` session keys containing the
original generation, operation key and bounded status body, no tokens or media.
Do not copy those bodies into diagnostics.

`provider_unavailable` is uncertain, including after the recorded work changes.
Restoration precedes terminal dispatch gates, so READY/FAILED/CANCELLED reloads
can reconcile the original receipt explicitly without automatic caption POSTs.
Malformed or inaccessible receipt storage cannot authorize a fresh paid key.

For expanded status-message and timing/provenance contracts, compare the backend
API reference with executable `api_tours.py`, `generation_progress.py` and
`progress_message.py`; code remains authoritative. Approved nonaudio checks
include `tests/ui-preparation-progress.test.ts`, `tests/ui-preparation-polling.test.ts`,
`tests/ui-generation-progress.test.ts` and `tests/ui-generation-progress-proxy.test.ts`.
Browser verification used actual components/controllers with synthetic snapshots
from the real backend serializer; built Nitro HTTP verification used a metadata-only
fixture. It does not qualify live worker timing, Firebase validation, paid provider
captions/research, GPS or audio.

## Research lifecycle controls and experimental tours

`TourResearchControls` is available on original tour cards and inside the detail
view's closed Tour research disclosure. The immediate draft action is prominent
on cards; history, compact progress, private files and enrichment use native
disclosures. `useTourResearchLifecycle` loads complete bounded history and
owner-scoped status. Cancellation, finish-early, regeneration
and acceptance require explicit confirmation and share `tourRequestStore` with
text/playback mutations. UID/tour fences reject late work. Failed confirmation
preserves the original body/key and blocks conflicting mutations until retry or
authoritative reconciliation. Normal acceptance invalidates matching cached tour
transcript/checkpoints without restoring stale persisted recovery.

Fresh matching-owner state retires impossible cancel/finish-early transitions,
without declaring success; viable uncertain operations keep their original keys.
Research refreshes and mutations synchronize matching active-tour metadata while
preserving its accepted package, record and transcript. Confirmed acceptance
supersedes old-generation text operations, fences old reads and requires a
successful matching-generation reload before interactions become available.

Finish-early requires RUNNING/RESEARCH and at least one completed stop. It continues
ordinary composition/review with research gaps, not immediate publication.
Regeneration can incur provider costs. Normal acceptance remains restricted to
the latest nonexperimental READY generation and backend session/publication rules.

`researchPreviewStore` and `useTourResearchPreviewAction` create a separate
owner-scoped experimental tour from an immutable source generation. The backend
cancels/drains active source work before sealing saved source-bound findings.
Contradicted, unsupported and known audit-rejected findings are excluded; missing
stops remain route-only gaps. The original package, visits and history are kept.
Draft warnings persist on list/detail views. Opening requests no narration or
media. Default reopening preserves the saved draft; an explicit new-version action
can replace a confirmed local result with a new operation, never an uncertain one.
Previews cannot recursively create previews or use normal generation controls.

Research download requests ignore backend download URLs and construct encoded
same-origin paths. JSON/text bytes use a separate private no-store proxy; the
existing audio artifact proxy remains audio-only. Lifecycle controls and downloads
add no browser persistence; caption recovery is separate above.
`tests/ui-research-preview*.test.ts`, `tests/ui-research-lifecycle*.test.ts`
and `tests/ui-research-controls.test.ts` are approved nonaudio checks in `test:text`.

`routePlacesStore` retains unresolved operations in memory per UID/tour across
navigation. A temporarily absent tour clears only display selection; account
changes clear owner state. Deferred language/generation discovery resumes when
the original operation settles. Completed backend receipt replay repairs
compatible tour publication under its lease/CAS, never another provider lookup.
Ordinary-place Ask requires the published discovery and place list.

Guide tags are backend `{ id, name }` objects; catalog/card filters use `name`.
Empty route geometry uses legacy Directions; malformed nonempty geometry does
not. Initial route fitting survives source loading, while style/theme restoration
of an existing route preserves the camera.
