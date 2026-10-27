# Personal Guide frontend

A mobile-first web app for location-aware walking tours. Choose a guide, plan a route, follow named stops on a map, and request narration or ask general questions during your walk. The text panel distinguishes saved route research from general AI answers.

This repository contains the browser UI and a Nuxt server proxy. The sibling [Personal Guide backend](../personal-guide.ai/README.md) handles authentication validation, route planning, tour preparation, persistence, research, and speech generation.

## Features

- Firebase sign-in with email/password or Google, with account-scoped tour state.
- Searchable guide discovery, style and topic filters, route variants, ordered stop previews, and generation progress.
- Optional interests, excluded topics, pace, and personal context for route planning.
- Theme-aware Mapbox maps, numbered stops, GPS following, a whole-route view, optional 3D exploration, and a draggable manual-simulation marker.
- Narration controls, visitor questions, and durable playback recovery.
- English and Russian UI, with language, voice, and model preferences.
- A text question composer, enabled by default, with source provenance, saved-research coverage and explicit retry/reload recovery.

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

Preparation milestone verification: 606 tests in 65 files, typecheck and an isolated
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

Guide interests follow the backend's `{ id, name }` tag contract. Cards and
filters display and search the name; IDs are not substituted for labels.

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

Walking maps show a person marker and a visible **Real GPS / Simulation** selector.
GPS uses a blue circular marker; simulation uses a purple square marker that can
be dragged or placed by clicking the map. Switching back to GPS removes the
simulated marker without changing real coordinates. The source choice survives
reloads; simulation initializes even with location permission denied, using GPS,
the route start or the map center. Switching modes does not move the camera.

The restored controls were browser-exercised with actual Mapbox rendering and
synthetic GPS: drag/click movement, keyboard switching, GPS-denied reloads,
mobile/desktop sizes, Russian and dark mode. No audio was exercised.

An empty stored geometry array uses the legacy routing fallback. Malformed
nonempty geometry never triggers a replacement route. A newly supplied route
retains its initial camera fit while sources load; restoring an existing route
after a style/theme change does not move the visitor's camera.

Verification: 433 approved nonaudio tests across 58 files, typecheck and production
build passed. Real Mapbox Standard rendering was exercised at mobile and desktop
viewport sizes in both themes, with 3D/flat controls, reduced motion, keyboard
popups, controlled denied-GPS state, style restoration and disposal. The browser
used software WebGL and isolated GPS/route metadata: live GPS, live Directions
responses, physical-device performance, authentication and audio remain unqualified.

## Stack

Nuxt 4, Vue 3, Pinia, Nuxt UI, Tailwind CSS, VueUse, native Firebase Auth, Nuxt i18n, and Mapbox GL. TypeScript 7's native CLI runs beside the maintained TypeScript 6 API needed for Vue SFC tooling. The app renders in the browser (`ssr: false`); Nitro serves its authenticated `/api/*` proxy.

Use NVM to install and select the pinned Node.js LTS release, `24.21.0`, with its latest compatible npm. `.nvmrc` and Docker use that release. The package engine range is `^24.21.0 || >=26.0.0`; Node 26 is allowed but is not the recommended development runtime. Use the pinned `pnpm@12.11.2` through Corepack and preserve `pnpm-lock.yaml` when installing dependencies.

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

Story-buffer metadata is optional for older backends. If the backend has no GET
route (its generic 404/405 response), the frontend proxy returns
`{ status: "unavailable", reason: "unsupported_backend" }` and uses the existing
completion-based continuation instead of buffered preparation. This does not
enable buffering on the backend. Authentication, tour/ownership errors and failed
buffer mutations remain errors; uncertain operations retain their recovery keys.

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

Fresh owner-scoped state releases a pending cancellation or finish-early request
when that transition is no longer possible; it does not claim the command succeeded.
Regeneration and cancellation update active research metadata without replacing
the accepted playback package. Acceptance clears old-generation text and requires
a successful matching-generation reload before text actions resume.

Ordinary-place discovery keeps unresolved request bodies and keys per account/tour
while navigating between tours. A changed language or generation waits for the old
operation to settle before discovery resumes. Backend replay repairs compatible
publication from the retained result without another paid lookup; incompatible
route, generation or language identities remain conflicts.

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

The standalone composer sends general questions without selecting a place or
sending GPS. These answers use general AI knowledge, not checked route research;
the helper beside Ask and conversation-kind guide replies state that distinction.
Historical source-backed stories retain their source links and are not relabelled.
Empty research does not disable general questions or silently change their mode.

**Saved route research** reports the API's `route_research_depth`: estimated
saved-text minutes against its target, eligible and missing factual words, and
independently verified versus unverified words. The current backend's minimum
route target is twenty minutes at 120 words/minute; the client displays the
returned target rather than hardcoding it. Capacity rounds down, so 76 words
display as 0.6 minutes, not a complete story or twenty minutes.

Not prepared, below target, target reached and unavailable metadata are distinct.
Missing metadata does not become a zero or an invented target. Selected-story
readiness stays separate: saved route inventory may remain after a place's
eligible evidence is exhausted. Neither READY, 100% preparation, captured pages
nor spending guarantees supported narration. The explanation disclosure describes
deduplication and makes clear that saved capacity is not remaining untold text,
independent approval or measured speech duration.

Coverage reuses the existing scoped experience read and adds no research or
provider request. Tour, Firebase UID and accepted-generation changes clear stale
coverage and replies. Questions retain the shared mutation queue and original
payload/key on uncertain retries. Tour preferences remain in route creation and
Settings; the composer has no place selector, context editor or activity controls.

Client verification used actual components and stores in Chromium with retained
Novi Sad zero-word metrics and synthetic boundary states: tiny/near-target
inventory, enough unverified text, exhausted stories, absent metadata, scope
changes and original-key question recovery. English/Russian, light/dark,
320/390-pixel mobile and 1280-pixel desktop layouts were exercised. The built
frontend served HTTP 200 and rejected an unauthenticated experience request with
HTTP 401. This does not verify live sign-in, provider answers, GPS or audio, and
does not establish twenty minutes of generated speech.

The approved nonaudio suite passed 721 tests; Nuxt/Vue and server/shared
typechecking and the production build passed. Build warnings remain for the
existing duplicate `IGeolocationStore` auto-import and large bundles. Changed
runtime files pass Prettier; an unrelated pre-existing formatting difference in
the external-review assertion in `tests/experience-question-ui.test.ts` was left
unchanged rather than restyling unrelated code.

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

**Full narration and compatible recovery.** Every new speaking turn requests one
complete response for the location or question. Fresh requests omit the legacy
narration style and duration hints; there is no FULL/SHORT selector, sentence
minimum or five-sentence pagination. The backend owns supported response length.
A new complete response has one final story chunk and never arms automatic
continuation at the same position. Historical multipart metadata remains readable,
and original active audio and uncertain request bodies/keys retain their identities.

Insufficient supported material/time, budget or research preparation gaps, route
choices, pauses and active unacknowledged audio have visible status rather than
an empty panel implying completion. A generated segment is not a delivered fact.
**Resume original audio** restores the durable active segment through read-only
`GET /api/story-buffer/{tourId}` metadata, including `active_record` and existing
audio. Recovery works for older empty `/next` responses without `playback_block`;
it sends no new narration POST and does not acknowledge completion. Recovered
audio stays paused until the visitor resumes. **New nearby story** explicitly
interrupts the original segment before requesting a new story.

For historical compatible multipart records, the existing story-buffer controller
is the single scheduler. With at most 40 seconds remaining it can prepare using
`POST /api/story-buffer/{tourId}/prepare`; preparation never replaces the current
audio. On actual audio completion, activation atomically completes the anchor
and adopts the returned record/audio. Uncertain prepare/activate operations
retain their immutable original body and key. Recovery never auto-starts audio.
Pause stops local playback immediately and cancels/fences late preparation.
Movement changes future selection, not the current segment's receipt.

GPS continuation requires a fresh accurate fix; the backend checks actual route
relation and accepted story scope at preparation and activation. Walking is not
limited to standing within 40 metres of a stop. Explicit manual mode sends the
selected map position with `position_mode: manual` and null GPS metadata. It
does not establish real arrival, visibility or safe access. The backend rejects
out-of-scope continuation without completing or restarting current audio.

The frontend flags `NUXT_PUBLIC_STORY_BUFFER_ENABLED` and
`NUXT_PUBLIC_TEXT_EXPERIENCE_ENABLED` default to enabled. The sibling backend
implements `/tours/{tourId}/story-buffer` and its prepare/activate/cancel routes
using the same durable playback store. Only the proxy's explicit
`unsupported_backend` capability response enables the legacy completion
fallback; supported endpoints, domain 404s and authentication failures never
start a second scheduler. These changes are not evidence of authorized real
provider latency, browser playback, heard audio or deployment.

Browser integration surface: `/tours/{tourId}`, selectors
`[data-testid=\"narration-duration\"]`, `story-progress`, `narration-reason`,
`story-buffer-status`, `resume-active-story`, `next-nearby-story` and
`reconcile-story` (the latter names are also `data-testid` values).
Run `corepack pnpm dev` from this repository for the real page. Deterministic
nonaudio component/controller fixtures are in `tests/ui-narration-status.test.ts`,
`tests/ui-story-buffer.test.ts` and `tests/regressions.test.ts`; they do not prove
real audio or paid-provider acceptance.

The tour page shows route position, the last recorded location, and the latest
guide text beneath playback controls. Recorded history restores this summary
after reload. A selected stop or walking target is labelled separately from a
confirmed stop. The position meter describes the stop's place in the route;
finishing early does not imply that every stop was visited. Guide text is the
recorded message, rather than proof that it was heard.

Earlier conversation turns display their stop and source links available in the current session. The panel explains when the backend no longer supplies links for an older turn. If a request has an uncertain outcome, retry it or reload to reconcile state. Text activities do not pause existing audio.

## Commands and verification

| Command                        | Purpose                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| `corepack pnpm dev`            | Run the development server.                                       |
| `corepack pnpm test:text`      | Run the approved nonaudio regression checks.                      |
| `corepack pnpm typecheck`      | Check Vue SFC types plus native TypeScript 7 server/shared types. |
| `corepack pnpm build`          | Build the production Nitro server and browser assets.             |
| `corepack pnpm preview`        | Preview a production build.                                       |
| `corepack pnpm prettier:check` | Check repository formatting.                                      |

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

The latest-major frontend migration uses Vue 3.5.44, Pinia 4.1.0 with
`@pinia/nuxt` 1.0.3, Firebase 13.0.0, Firebase Admin 14.5.0 and Mapbox GL 3.33.0.
VueFire and its Nuxt module are removed: `app/plugins/00-firebase.client.ts`
initializes native Firebase Auth and the optional Enterprise App Check provider.
Login/profile consumers share its `$firebaseUser` ref, and route guards await
Firebase's persisted-auth restoration. Existing `VUEFIRE_*` environment names
still configure the public client; no existing `.env` migration is required.

Vite and its Vue plugin remain explicit test-tool dependencies. Mapbox GL
supplies its own types; GeoJSON annotations import the separately declared
`@types/geojson` package.

`pnpm-workspace.yaml` contains scoped security overrides for Firebase's gRPC transport,
Google GAX and its HTTP helpers' UUIDs, fontless's esbuild and typography's selector
parser. Nuxt UI's Tiptap peers are pinned together because they require matching
versions; updating only the editor core leaves incompatible extensions. Review
these overrides when their parent packages adopt fixed releases, and keep the
lockfile in sync.

Nuxt DevTools 3.4.3 removes `simple-git` from the dependency graph, resolving its
critical and two high advisories without forcing an incompatible Git major.
The obsolete Git argument-parser override has been removed.

The registry audit still reports two high upstream advisories; both affected
behaviors have version-pinned local code patches:

- [`node-forge` 1.4.0: nested DigestAlgorithm signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
  [`patches/node-forge@1.4.0.patch`](patches/node-forge@1.4.0.patch) backports the
  proposed [upstream fix](https://github.com/digitalbazaar/forge/pull/1152), checking
  nested algorithm element counts instead of accepting unconsumed garbage.
- [`braces` 3.0.3: stack exhaustion from deeply nested patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
  [`patches/braces@3.0.3.patch`](patches/braces@3.0.3.patch) limits parsed
  brace/parenthesis nesting to 100 and guards all three recursive AST walkers,
  including direct AST inputs. Excessive nesting raises a controlled SyntaxError.

Neither has a published fixed version as of 2026-10-15. The patches are registered
in `pnpm-workspace.yaml` and apply during frozen installs, including Docker.
The Dockerfile copies `patches/` before installation; `.private` staging and smoke
material are excluded from the build context. These are transitive development/
build dependencies; that classification alone does not establish runtime safety.

`pnpm audit` remains nonzero because it matches the original package versions,
not the local patched code. No advisory ignores, package renaming or misleading
version changes are used. Replace the patches when verified upstream fixes ship.
The eight focused regressions in `tests/ui-dependency-security.test.ts` pass;
real Node RSA/glob consumer smoke also passed on the host and in an offline
container with a frozen dependency installation. On the updated working tree,
all 649 approved nonaudio tests in 65 files, Nuxt/native type checks, production
build and the frontend Docker build stage passed. No image was deployed and no
audio was exercised.

TypeScript uses Microsoft's [documented side-by-side installation](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/):
`@typescript/native` aliases TypeScript 7.0.2 and supplies `tsc`; `typescript`
aliases `@typescript/typescript6` 6.0.2 and supplies the maintained 6.0.3 JS API
and `tsc6`. Vue's checker still requires that API, so native 7 does not replace
SFC checking. `pnpm typecheck` first runs Nuxt/Vue checks and then checks the
generated server/shared projects with native 7. Node types stay on the latest
Node 24 line to match the pinned runtime.

[pnpm 12 configuration](https://pnpm.io/settings) lives in
`pnpm-workspace.yaml`: existing hoisting, pre/post hooks, security overrides and
approved dependency builds were migrated there, and Docker copies it before
installation. The obsolete project `.npmrc` and `package.json.pnpm` were removed.
Release-age exceptions name only the four explicitly requested logos/Vitest
patch versions. No unrestricted build permission or advisory suppression was added.

Current upgrade verification passed 635 approved nonaudio tests in 63 files,
Nuxt/Vue and native TypeScript checks, production build and a frozen-lockfile
installation. The production login screen and anonymous private-route redirect
were browser-exercised without signing in. A separate metadata-only browser
surface used the actual Mapbox components to check stored-route rendering,
whole-route fitting, simulated person dragging, GPS switching and landmark popups.
The browser used software WebGL and synthetic GPS/route metadata. External
Iconify was blocked in the login smoke, so its Google icon was not qualified.
Production proxy smoke returned 401 before upstream access. Live sign-in,
provider-backed text, physical GPS/Directions and audio were not exercised.
The audit still reports the two high upstream advisories above.

Earlier Docker verification completed a clean frozen install and Nuxt build
with the workspace configuration. Docker was not rebuilt or deployed for the
latest-major migration.

The omp skill audit added `pinia`, `pnpm`, `vitest`, `vueuse-functions`,
`firebase-auth-basics` and `mapbox-web-integration-patterns` to the user-level
`~/.agents/skills` directory, alongside the existing Nuxt, Vue, UI, review,
security and browser-testing skills. Restart omp to refresh a session's cached
skill inventory. Existing Pinia/pnpm skill revisions describe Pinia 3/pnpm 10;
the application now uses Pinia 4/pnpm 12, so consult current package contracts
for migration differences. Skills are local agent tooling, not application
dependencies or deployment requirements.

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
