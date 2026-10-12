# Personal Guide frontend

A mobile-first web app for location-aware walking tours. Choose a guide, plan a route, follow named stops on a map, and request narration or ask questions during your walk. The optional current-stop text panel adds explanations, activities, navigation instructions, and source links.

This repository contains the browser UI and a Nuxt server proxy. The sibling [Personal Guide backend](../personal-guide.ai/README.md) handles authentication validation, route planning, tour preparation, persistence, research, and speech generation.

## Features

- Firebase sign-in with email/password or Google, with account-scoped tour state.
- Searchable guide discovery, style and topic filters, route variants, ordered stop previews, and generation progress.
- Optional interests, excluded topics, pace, and personal context for route planning.
- Theme-aware Mapbox maps, numbered stops, GPS following, a whole-route view, optional 3D exploration, and a draggable manual-simulation marker.
- Narration controls, visitor questions, and durable playback recovery.
- English and Russian UI, with language, voice, and model preferences.
- An opt-in text experience with stop selection, questions, backend navigation instructions, and explicit save/clear actions for future preferences.

The layout fills a mobile viewport and uses a phone-style frame on desktop. Route previews report unknown access and opening conditions; step-free routing needs verified accessibility along the whole path. Research-management controls are available on original tour cards and detail views; account-deletion screens remain outside the current UI scope.

## Preparation progress and ordinary places

Owner-scoped cheap status polling reports stage-weighted percent, elapsed time,
and a research deadline or explicitly unknown remaining time. The current-work
caption keeps source activity timestamps separate from caption generation time;
the server's stale classification invalidates cached live-sounding captions.
Percent/READY and source counters are not evidence approval or story availability.

Rich progress is enabled by default. Set `RICH_PROGRESS_ENABLED=false` in the
**backend** `.env` and recreate its environment-bearing processes to keep only
basic phase/status/percent without new paid caption requests. No duplicate client
environment switch is needed; the owner response carries the setting.

Visible list/detail consumers share explicit small-model caption operations.
Hidden/offscreen consumers do not request paid refreshes. Session storage retains
an uncertain operation's original generation, language, body and idempotency key;
manual reconciliation retries that operation, never a fresh paid key. Restoration
happens before terminal-state and rich-mode gates, so a reload still offers recovery.
Disabling and re-enabling rich mode does not discard or automatically replay unknown
work. Provider-unavailable uncertainty also blocks automatic replacement requests.
Storage failures conservatively block new paid captions while cheap polling works.
Caption metadata never replaces authoritative timing, numeric facts, source clocks
or factual `status_text`, including spending embedded in that status sentence.

Public ordinary-place labels appear separately from required numbered stops.
Their Google IDs distinguish same-name buildings; labels are not historical
evidence or safe-access instructions. Selecting a typed ordinary subject requests
its own coverage/qualified content without visiting an attraction or borrowing
another place's story. Discovery uncertainty keeps its original lookup key/body.
Routed geometry retains `geometry_leg_starts`; map lines, navigation distances and
walking simulation do not bridge disconnected legs. Unrecoverable legacy discovery
geometry is withheld rather than displayed as a fabricated continuous path.

Latest local text-only verification: 606 tests in 65 files, typecheck and an isolated
production build passed. The actual Nuxt preparation component was browser-exercised
with labelled fixtures: a full terminal-state reload restored manual recovery with
the original request key; provider-timeout uncertainty prevented new paid POSTs;
fresh GET status and spending remained visible after a lost caption response.
This is render/recovery proof, not authenticated tour delivery, live-model caption
wording, field navigation or heard audio. No live services were restarted for this
verification; the existing duplicated `IGeolocationStore` auto-import warning remains.

## Choose your guide

Search guide names, expertise and interests, then combine a conversation-style
filter with a topic. Cards show the guide's starting style, a short introduction
and interest tags; **Get to know this guide** expands the full profile and your
own saved tours with that guide. Missing portraits use a name initial.

Browsing and filtering do not change your route draft. **Plan a walk with…**
explicitly selects the guide, resets the previous route draft and opens route
planning. You can change the interaction style while planning. Discovery stays
on one page, with no extra requests or browser storage for filters.

## Maps

Creation and walking maps start flat. **Follow me** follows available GPS until
the visitor stops following, gestures on the map or chooses **Whole route**.
Missing GPS disables following without blocking route exploration. **Explore in
3D** enables buildings and landmarks at a restrained 40-degree pitch; **Flat map**
returns to the walking view. Reduced-motion preferences remove control animations.

Light/dark palettes cover the basemap, outlined routes, markers, labels, popups and
legend. Theme changes retain the map, route geometry, markers and camera.
Stored and legacy routes share zoom-dependent styling; style reloads restore
displayed geometry without another route request or automatic fit. Landmark
buttons support keyboard activation and never relocate the simulation marker.

Verification: 433 approved nonaudio tests across 58 files, typecheck and production
build passed. Real Mapbox Standard rendering was exercised at mobile and desktop
viewport sizes in both themes, with 3D/flat controls, reduced motion, keyboard
popups, controlled denied-GPS state, style restoration and disposal. The browser
used software WebGL and isolated GPS/route metadata: live GPS, live Directions
responses, physical-device performance, authentication and audio remain unqualified.

## Stack

Nuxt 4, Vue 3, TypeScript, Pinia, Nuxt UI, Tailwind CSS, VueUse, Firebase/VueFire, Nuxt i18n, and Mapbox GL. The app renders in the browser (`ssr: false`); Nitro serves its authenticated `/api/*` proxy.

Use NVM to install and select the pinned Node.js LTS release, `24.21.0`, with its latest compatible npm. `.nvmrc` and Docker use that release. The package engine range is `^24.21.0 || >=26.0.0`; Node 26 is allowed but is not the recommended development runtime. Use the pinned `pnpm@10.34.6` through Corepack and preserve `pnpm-lock.yaml` when installing dependencies.

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
nvm install v24.21.0 --latest-npm
nvm use v24.21.0
node --version
npm --version
corepack enable
corepack pnpm install --frozen-lockfile
# Keep an existing .env; copy the example only for a new checkout.
test -f .env || cp .env.example .env
```

Fill in `.env` using the configuration below. Use the same Firebase project as the backend and enable the sign-in methods you intend to use. Keep provider keys and Firebase service-account credentials on the backend; this frontend uses public Firebase client configuration and a public Mapbox token.

Git excludes local environment files, Nuxt output, coverage/browser reports,
Playwright authentication state, private research and hidden `tests/.review-*`
probes. `.env.example` and permanent regression tests remain versioned.

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
| `NUXT_PUBLIC_TEXT_EXPERIENCE_ENABLED`                                     | Enables the current-stop text panel; defaults to `true`.                                            |
| `NUXT_PUBLIC_STORY_BUFFER_ENABLED`                                        | Enables automatic continuation; defaults to `true`, with separate backend support required.         |

Endpoint overrides such as `PG_API_GUIDES_URL` and `PG_API_CREATE_ROUTE_URL` are optional. The proxy defaults match the sibling backend's `/guides/`, `/tours/`, and `/users/me/` paths. See [AGENTS.md](AGENTS.md#endpoint-mapping-and-environment) for the full mapping.

Firebase client configuration comes from `nuxt.config.ts` at build time. Rebuild after changing it. The backend origin stays private: browser API clients call the same-origin `/api/*` routes, attach Firebase ID tokens, and let Nitro forward them to the backend for validation and ownership checks.

## Try a tour before research finishes

Original-tour cards and detail views offer **Stop research and try draft** while
preparation is active, or **Try saved research** after failure, cancellation or
completion. Confirmation creates a separate experimental draft from saved
source-grounded findings; the original tour, published package and history stay
unchanged. Missing research remains an explicit gap, including route-only drafts.
The draft is unverified and is not a normally published tour.

Opening a draft does not request narration or start audio. Its detail view keeps
the warning visible and offers the ordinary **Start tour** control. Drafts cannot
recursively create another draft. Uncertain creation retries preserve their
original generation, payload and idempotency key; a saved draft can be reopened
after failed navigation without another creation request.

**Research details and controls** opens generation history, current status,
saved research downloads and separate background-enrichment inspection. Only
eligible actions appear:

- **Finish research with completed stops** requests normal composition/review
  early when research is running and at least one stop is completed. It does not
  make the tour ready immediately or bypass publication checks.
- **Stop research only** cancels the selected generation without opening a draft.
- **Research again** explicitly queues another version and can incur provider
  costs; the existing published version stays available.
- **Use prepared version** accepts the latest normal ready generation only when
  ordinary backend publication/session checks allow it.

Advanced counters and files stay collapsed by default. Selected versions use
localized dates and readable file labels. After saving a draft, ordinary opening
reuses it; **Try the newly selected research** explicitly creates another snapshot
when a different generation is selected. An uncertain operation must be retried
or reconciled before another mutation. Cancelling preparation does not stop
background enrichment: the backend currently exposes no enrichment-cancel route.

Verification exercised the real Vue controls at mobile and desktop widths with
English/Russian copy, a controlled identity, a production-built Nitro proxy and
an isolated real backend/MongoDB fixture. History, private JSON download,
enrichment inspection, finish-early, regeneration, cancellation, experimental
navigation and a 503 retry were exercised without narration/media requests.
The persisted preview knowledge consumer retained two source-linked findings,
excluded a contradicted finding and returned no invented facts at two missing
stops. Research progress was simulated; this does not qualify real Firebase,
live provider research, Mapbox/GPS, normal early-finish publication or audio.

## Live research progress

Tour cards and detail views show the backend's stage-weighted preparation
percentage, time since queued, latest recorded activity and research gaps.
Remaining time is explicitly a current-stage deadline or unknown—not a promised
finish time. Ended processing is distinct from success, and 100% does not mean
every stop has a usable story.

Compact cards keep the main measurements visible and put full status, source/action
counts, saved findings, per-stop work and spending in **Research details and
spending**. Saved findings are not proof of independently reviewed facts.
The stop-and-try action appears above progress. Pending research and refreshes
have reduced-motion-aware spinners; failed reads retain the last measured values.

Visible cards and tour details read the current generation every five seconds;
hidden/offscreen cards suspend their reads and terminal states stop polling.
The backend's `RICH_PROGRESS_ENABLED` defaults to true; when disabled, the UI
keeps basic stage/percentage display without enhanced details or paid captions.

The new `progress-message` endpoint provides guarded status wording through a
separate backend Nano role and can incur provider costs. The UI identifies
model-generated, fallback and recorded text. It never substitutes generated
wording for measured progress. Uncertain caption requests retain their original
payload/key in owner-scoped session storage and require explicit reconciliation,
not a fresh paid request.

Verification covered mobile/light and desktop/dark views, English/Russian
activity, pending/failed/recovered reads, terminal states, preview-gap metadata,
keyboard disclosures and backend feature disablement. Snapshots came from the
real backend serializer; HTTP checks exercised the built Nitro proxy against
a metadata-only fixture. Live research, paid caption generation, Firebase
validation and audio remain unqualified.

## Current-stop text experience

The frontend text panel defaults to enabled. To set it explicitly:

```dotenv
# Frontend .env
NUXT_PUBLIC_TEXT_EXPERIENCE_ENABLED=true
```

Set `TEXT_EXPERIENCE_ENABLED=true` in the backend configuration and restart the affected services. Without both flags, the text panel or backend endpoints remain unavailable.

In the panel, select a stop, ask a question, or use the navigation shortcuts. Navigation instructions and status come from the backend. GPS sharing requires a fresh fix and GPS mode; a manual simulation marker does not represent your physical location.

Per-tour context edits apply to that walk. Use the save action to update preferences for future tours, or the explicit clear action to remove them. New route drafts load those saved preferences without overwriting edits you made while the profile loaded.

Choose **Guide's style**, **Explore together**, or **Just guide me** in the personal-context form. Guide's style follows the selected guide card; Just guide me keeps stories and directions without unsolicited questions. You can still ask your own questions and use photo/rest controls. Apply a change to the active walk with **Apply to this walk**; saving it for future tours is a separate action. The panel shows the backend's effective style. Clearing personal memories can retain an operational no-questions override; change the selector explicitly to replace it.

In development (`pnpm dev`), a **Next step** button beside Pause/Resume requests another step through the existing tour action. It is hidden in production builds.

The development walking screen puts the full latest guide message immediately
below those controls, with progress in a collapsed **Your walk** section beneath
it. **Next step** uses the current position from the active GPS or simulation mode,
sampling it again after any pending playback acknowledgement. An uncertain retry
keeps its original payload and operation key.

Switch to simulation mode and press **Move 300 m** to animate the walker along
the displayed route over three seconds. Press **Stop moving** to stop midway;
the next move continues from there. Movement stops at the route's end and respects
reduced-motion settings. It does not request narration automatically. Use
**Next step** to request guidance at the new position. The movement control is
unavailable until route geometry is ready and is hidden in production.

The map distinguishes GPS position, the simulated walker and numbered tour
stops. Tap a stop to read its name. Street labels and an outlined route help
orient the walk; marker numbers describe route order rather than visited stops.

Objects referenced in the latest guide message gain an amber halo and a visible
name on the map. Route stops keep their numbers; returned places outside the
route get their own markers. Highlights update with each nonempty guide reply,
including replies in the text panel. Empty updates keep the last message's
highlights. This follows the whole message, rather than individual spoken words.
Only places with known coordinates can be highlighted; unknown names and aliases
are not geocoded. Reload restores known route subjects from saved history;
response-only places outside the route are not stored in that history.

**Automatic same-stop stories** request one prepared continuation when the backend
supports story buffering and the current story has at most 40 seconds left.
The current recording, text and map focus remain in place until completion.
Activation atomically acknowledges that
segment and returns the next story's text, map focus and existing private recording
reference. Buffer preparation itself does not generate new recordings. Preparation stops when
supported prepared stories are exhausted. Each newly started story gets the same
40-second preparation window, so continuation repeats until you press **Pause**
or another eligibility condition changes.

At a stop with a fresh, accurate GPS fix, the client requests the backend's
90-second stationary story budget instead of its default 20-second walking mode.
Visitor questions also use the 90-second budget. Moving or uncertain locations
retain brief orientation on tours with a published generation. Legacy tours
request a 90-second upper target and let backend location guidance choose a
20-second walking transition or a longer stop story. Simulated coordinates never
acquire GPS metadata; move the marker close to a stop for its story. Simulation
does not trigger automatic continuation. Empty replies caused by no new content
or no location change show a hint to move closer or ask a specific question.
These are upper targets: supported evidence, prepared
content and backend policy determine how much text is actually returned.

The text panel and automatic-continuation frontend flags are enabled by default,
as requested. There is no feature-toggle section on the tour page; **Pause**
stops the current story and cancels its prepared continuation. It requires
a fresh GPS fix whose distance plus accuracy is within 40 metres of the stop;
simulation and unknown/stale GPS cannot establish that condition. Pause, visitor
actions, movement, settings changes, hidden pages and navigation suspend the buffer.
An explicit action reconciles uncertain requests before proceeding; if that fails,
the notification asks you to retry or reload. Recovered stories remain paused and
consumed stories never replay.

The backend must implement the
[story-buffer contract](../personal-guide.ai/.private/worktrees/system-improvement/current_implementation/proposed_tour_generation/story_buffer_contract.md)
and enable `STORY_BUFFER_ENABLED` and `TEXT_EXPERIENCE_ENABLED`. The frontend
switches are `NUXT_PUBLIC_STORY_BUFFER_ENABLED` and
`NUXT_PUBLIC_TEXT_EXPERIENCE_ENABLED`. A backend without the buffer contract retains
the existing manual controls and uses a completion fallback: the client arms one
continuation when 40 seconds remain, acknowledges completion, then waits one second
before requesting another turn with the latest GPS fix. This avoids sending a
speculative `/next` while the backend still has an active segment. A silent `WAIT`
ends this chain; the client does not poll it. The same GPS, cancellation and
one-request-per-story rules apply to legacy tours. Lookahead preparation before
completion still requires the backend story-buffer contract.
The completion fallback uses the ordinary narration endpoint and the selected model
and voice settings.
Only metadata/control transitions have been verified. Audio and playback
qualification still require explicit human approval.

The tour page shows route position, the last recorded location, and the latest
guide text beneath playback controls. Recorded history restores this summary
after reload. A selected stop or walking target is labelled separately from a
confirmed stop. The position meter describes the stop's place in the route;
finishing early does not imply that every stop was visited. Guide text is the
recorded message, rather than proof that it was heard.

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

`test:text` covers text interactions, interaction preferences, route contracts, GPS update coordination, navigation display, safe rendering, saved preferences, request serialization, authentication boundaries, route draft restoration, map following, accessible controls, notifications, and loading/error states. Its Vue component checks render in Node; they do not launch a browser.

**Audio verification requires explicit human approval.** Do not generate, listen to, test, or benchmark audio under the current milestone. The full `test` suite includes audio checks; `test:smoke` and `test:dev` exercise the narration contract. All three are excluded until that approval. This does not prohibit the approved nonaudio `test:text`, typecheck, build, or focused formatting checks. After approval, `test:smoke` requires a build; run `test:dev` separately from builds because both write `.nuxt` files.

Check sign-in, maps, GPS, and provider-backed text in a configured browser. Passing unit tests and a build does not establish live provider behavior or route accessibility. Format changed files rather than running `pnpm prettier` across unrelated files.

### Dependency and omp skill maintenance

Use compatible stable releases rather than treating every new major as a required
upgrade. Firebase 12 and Firebase Admin 13 remain inside VueFire's declared peer
ranges; Pinia 3, VueUse 14 and TypeScript 6 remain the current application
contracts. Vite and its Vue plugin are explicit test-tool dependencies rather
than accidental hoisted imports. Mapbox GL supplies its own types; the deprecated
`@types/mapbox-gl` stub is not needed. GeoJSON annotations use explicit imports
from the separately declared `@types/geojson` package instead of an implicit
global namespace.

`package.json` contains scoped security overrides for Firebase's gRPC transport,
Google GAX and its HTTP helpers' UUIDs, fontless's esbuild, typography's selector
parser and Git's argument parser. The parser 2.0.1 override preserves the API and
default Git export used by Nuxt's existing `simple-git` 3 consumer; a controlled
smoke check confirmed that `VISUAL` is now blocked while safe Git reads still
work. Nuxt UI's Tiptap peers are pinned together because they require matching
versions; updating only the editor core leaves incompatible extensions. Review
these overrides when their parent packages adopt fixed releases, and keep the
lockfile in sync.

The dependency audit still reports upstream issues. `node-forge` and `braces`
have no published fixed versions. Nuxt DevTools still imports the default export
from `simple-git` 3; the patched major 4 removes that export, so a forced override
would break the consumer. DevTools is disabled in `nuxt.config.ts`, but that does
not remove its packages or advisories. Do not suppress these findings; revisit
them when compatible upstream fixes are available.

The omp skill audit added `pinia`, `pnpm`, `vitest`, `vueuse-functions`,
`firebase-auth-basics` and `mapbox-web-integration-patterns` to the user-level
`~/.agents/skills` directory, alongside the existing Nuxt, Vue, UI, review,
security and browser-testing skills. Restart omp to refresh a session's cached
skill inventory. The Pinia and pnpm skills use revisions matching Pinia 3 and
pnpm 10; do not blindly update them to guides for newer majors. Skills are local
agent tooling, not application dependencies or deployment requirements.

The initial 2026-10-11 maintenance check passed 295 approved nonaudio tests, the focused
stored-route regression, type checking, production build, focused formatting and
a frozen-lockfile install. Read-only HTTP fixtures exercised production and
development SPA serving, authentication rejection and proxy responses without
calling narration endpoints. Browser checks covered mobile/desktop sign-in
rendering, the registration-form transition and the unauthenticated tour
redirect; no account was created or signed in. These checks do not qualify live
Firebase authentication, Mapbox/GPS, provider-backed text or audio. The dependency
audit decreased from 122 findings to six (four high, two critical), all in the
upstream dependencies described above.

The subsequent correctness review fixed lost preparation polling after page
reentry, duplicate creation after remounting, and delayed responses consuming
newer drafts. Creation now uses an account-fenced store-level lock. Navigation
storage is UID-scoped, rejects unsafe/malformed entries and tolerates blocked
storage; ownerless legacy navigation data is discarded. Authentication redirects
share one internal-path validator, and tour identifiers remain single encoded
API path segments.

Controlled-identity browser checks against a nonaudio fixture backend exercised
the actual mobile/desktop creation controls, remount locking, late draft edits,
account-switch clearing, malformed navigation, blocked-storage settings return
and resumed preparation polling. These are fixture checks, not real Firebase
sign-in, live Mapbox/GPS or provider verification. No audio or narration requests
were made.

The follow-up review passed 322 approved nonaudio tests across 51 files, type
checking, the production build and a frozen-lockfile install. The compatible
argument-parser override removed one critical advisory; the final audit reports
five remaining upstream advisories (four high, one critical). These findings
remain visible rather than being suppressed.

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

| Path                           | Responsibility                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `app/pages/`                   | Login, guides, route creation, tours, and settings.                                       |
| `app/components/tour/`         | Route preview, playback text, and current-stop experience.                                |
| `app/stores/`                  | User preferences, route drafts, tours, text state, GPS, and request coordination.         |
| `app/composables/`             | API clients, authentication, maps, tour actions, and UI helpers.                          |
| `shared/`                      | Interaction preference types, context defaults, and command reconciliation.               |
| `server/api/`                  | Authenticated backend proxy handlers.                                                     |
| `server/utils/http.ts`         | Upstream URLs, auth forwarding, request IDs, timeouts, and retry rules.                   |
| `i18n/locales/`                | UI translations; English and Russian are offered.                                         |
| `tests/`                       | Vitest regressions and component rendering checks.                                        |
| `scripts/smoke.mjs`            | Production/development HTTP fixture checks, subject to audio approval.                    |
| `docs/future-self-guidance.md` | Durable advice for future frontend changes, contract boundaries, and verification limits. |

## Troubleshooting

| Symptom                                                        | Check                                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node or pnpm is missing                                        | Source NVM, run `nvm install v24.21.0 --latest-npm` followed by `nvm use v24.21.0`, then use `corepack pnpm`.                                    |
| Sign-in fails or the API rejects a token                       | Check Firebase client configuration, enabled sign-in providers, and the backend's Firebase project. Rebuild after changing client configuration. |
| Proxy reports an upstream configuration or connection error    | Check the backend origin, port 3001, and backend availability. Inside Docker, use the host-gateway origin rather than container `localhost`.     |
| A tour remains in preparation                                  | Check the backend generation worker, the preparation error shown on the tour list, and the read-only preparation progress snapshot.              |
| No route variants appear                                       | Read the backend explanation and adjust start, duration, or preferences. Empty suggestions can indicate an infeasible or unverified route.       |
| The map or GPS is unavailable                                  | Check the Mapbox token, browser location permission, and secure context. Manual simulation allows route exploration without a live fix.          |
| The text panel is missing or unavailable                       | Check both feature flags and backend text-provider configuration.                                                                                |
| Development reports `Vite Node IPC socket path not configured` | Install the pinned lockfile dependencies. This project uses Nuxt 4.6.1; avoid downgrading to the affected 4.4.4 release.                         |

For integration changes, read [AGENTS.md](AGENTS.md), the [backend API reference](../personal-guide.ai/current_implementation/api_reference.md), and the [backend architecture](../personal-guide.ai/current_implementation/architecture.md). Check executable handlers and Python models when documentation and client types disagree.
