# Personal Guide frontend

## Workspace boundary

The frontend owns the Nuxt UI and Nitro proxy. The sibling backend at
`../personal-guide.ai/` owns authentication validation, persistence, routing,
research, narration, and speech generation.

**Treat the backend as read-only for every frontend task, including delegated
work.** You may inspect source and docs. Do not edit files, change Git state,
run backend jobs or tests, or mutate backend services or data. If the frontend
needs a backend change, describe the required contract for a separately
authorized backend task.

For API work, trace the browser composable, `server/api/` handler,
`server/utils/http.ts`, backend endpoint, and Python models. Read
`../personal-guide.ai/current_implementation/api_reference.md` for the contract
and use executable code when it differs from documentation. The API runs on
port 3001 by default and uses no version prefix.

## Setup and verification

- Use Node 24.21.0 from `.nvmrc` and pnpm 12.21.0 from `package.json`. Use
  `corepack pnpm` if pnpm is unavailable. Install with
  `pnpm install --frozen-lockfile` and preserve the workspace configuration,
  dependency patches, and lockfile.
- Use `pnpm dev` for the local frontend on port 3000. See `README.md` and
  `.env.example` for setup. Keep existing `.env` values and secrets private.
  The Nuxt SPA still requires Nitro for its authenticated API routes.
- For code changes, run `pnpm test:text`, `pnpm typecheck`, `pnpm build`, and
  Prettier on changed files. Run Nuxt checks that write `.nuxt` sequentially.
  Exercise the affected nonaudio browser flow when available. Check mobile and
  desktop for layout changes. For docs-only edits, check links and formatting.
- **Explicit human approval is required to generate, play, listen to, test, or
  benchmark audio.** Until then, exclude the full `pnpm test`,
  `pnpm test:smoke`, and `pnpm test:dev` runs. Keep existing playback behavior.
- Keep Nuxt/Vue SFC checking and native TypeScript checking enabled. Preserve
  the pinned `vite-plugin-checker` compatibility patch and the current
  dependency security patches until their upstream replacements are verified.

## Frontend contracts

- Use Vue Composition API, `<script setup lang="ts">` for typed components, and
  nearby controls and styles. Update English and Russian locale messages for
  user-facing text. The desktop layout frames the mobile UI above 768px.
- Use the authenticated `$apiFetch` client for same-origin `/api/` requests.
  Firebase ID tokens must stay on that origin, and identity changes must
  invalidate pending reads and owner-specific state. Forward auth, request IDs,
  and idempotency keys through the proxy. Encode API IDs as path segments.
  Automatic retries are for reads. Keep private upstream URLs, credentials,
  profile data, and visitor messages out of browser bundles and logs.
- Keep Firebase auth restoration ahead of route redirects. Validate return
  paths locally and scope stored tour recovery and navigation to the owner.
- API coordinates use `{ lat, lng }` strings. Mapbox coordinates use numeric
  `[longitude, latitude]`. GPS is the default. Missing GPS never falls back to a
  landmark. Manual simulation stays separate from GPS evidence.
- New walks use `/create-walk` and server-owned route plans. Detect native tours
  by `route.walking_plan` and mount one playback controller per tour. Native
  preparation is at `/tours/:tourId` and the published walk opens at
  `/tours/:tourId/walk`. Only an explicit Start starts the walk. Preserve the Web Lock,
  generation/revision fences, and native contract version header. See
  [Route-native client integration](docs/route-native-client.md).
- Preserve the original payload and key for uncertain mutations. Keep
  accepted playback generations distinct from the latest preparation
  generation. Use reported preparation progress and distinguish a completed
  research snapshot from a published, playable tour. Keep recovery and
  navigation owner-scoped and discard stale results.
- Keep historical tours on the legacy playback contract. Preserve text,
  silent responses, explicit continuation, and paused recovery across reloads.
  GPS and timers must not substitute for authorized user actions or backend
  eligibility. Dispose of map objects, watches, timers, and media resources
  when their owning scope ends.

Keep changes in scope and preserve existing working-tree changes. Use
`app/` for UI, stores, and composables, `shared/` for shared contracts, and
`server/` for the proxy. Keep generated output and dependency installations out
of source edits.
