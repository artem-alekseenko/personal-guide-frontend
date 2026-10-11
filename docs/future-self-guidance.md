# Future-self guidance

This is the short operational memory for future work in the frontend repository. It supplements `AGENTS.md`; it does not replace the executable code, backend models, or focused tests.

## Evidence and scope

The accessible archive contains one frontend conversation and several sibling-backend conversations. The frontend archive does not contain a long historical thread. The backend history repeatedly covered refactoring, route generation, grounded guide behavior, provider configuration, and runtime validation; its most recent trace-analysis attempt was interrupted before it produced a complete trace inventory. Treat this document as evidence-backed guidance from the current checkout and those accessible conversations, not as a claim that every Codex trace was reviewed.

The current repository guidance is unusually detailed because this project has accumulated several stateful contracts. Read `AGENTS.md` before changing behavior. Read the backend sources named there when changing an API contract.

## Core decisions

1. **Keep the frontend thin.** Browser code owns presentation, interaction state, Mapbox/GPS adapters, local recovery, and the authenticated same-origin API client. The backend owns Firebase token validation, ownership, persistence, route planning, preparation, research, narration, speech, and provider credentials. Do not move provider calls, generation logic, or secrets into the browser.
2. **Treat frontend and backend as one contract.** For an integration change, trace all layers in order: browser composable/store → Nitro handler → `server/utils/http.ts` → backend endpoint → Python request/response model and service. Executable handlers and models win when documentation and handwritten frontend types disagree.
3. **Prefer boring explicit state machines.** This app has concurrent queues, uncertain mutations, generation changes, GPS evidence, playback recovery, and page/account disposal. Preserve request versions, operation IDs, idempotency keys, scope fences, and cancellation epochs. Do not replace them with optimistic shortcuts or a second queue.
4. **Prove behavior at the right boundary.** Unit tests cover deterministic state and proxy contracts; `test:text`, typecheck, and build are the approved current checks. A build does not prove Firebase, Mapbox, GPS, provider text, backend workers, or browser behavior. Audio verification is explicitly prohibited until human approval.

## Rules for common changes

### API and authentication

- Browser requests go through same-origin `/api/*` and the authenticated `$apiFetch` client. Never add a direct browser request to the backend or a provider.
- Preserve the `Authorization` boundary, request IDs, timeout/retry policy, mutation idempotency, and upstream-origin restriction. Never log bearer tokens, profile bodies, visitor messages, recovery records, or media metadata.
- A request that can be retried must have a defined idempotency/reconciliation story. Uncertain mutations retain the original request body, generation, operation ID, and idempotency key until a successful read or explicit user-directed recovery resolves them. Do not rebuild a retry from newer GPS, settings, or text input.
- Keep owner/account/tour/generation fencing. Firebase UID ownership and backend `user_id` are related but not interchangeable with the frontend identity or tour ID.
- Update proxy tests when changing endpoint mapping, auth forwarding, retries, origin checks, or response unwrapping. Do not test a trivial forwarder by asserting only that a mock was called.

### Tour state and mutation ordering

- `tourStore` owns active-tour data; `experienceStore` owns current-stop text state; route and guide stores own their separate domains. Do not merge them to make a local change easier.
- Text interactions, playback receipts, finish, and story-buffer controls share a per-tour backend lease. Use the existing mutation queue. Explicit actions reconcile pending work before proceeding; failed reconciliation must keep later text mutations blocked and show retry/reload guidance.
- Local pause is immediate. Persistent pause/resume, completion, finish, text commands, and buffer transitions remain serialized. A late response must be ignored after account, tour, generation, navigation, or disposal changes.
- A silent `WAIT` is a meaningful backend response, not an empty success. Do not append empty transcript text, start playback, poll it as if it were pending, or infer a route turn from a stop name.
- Keep the old playable record until a new record is actually activated. Preparation, metadata reads, or failed reconciliation must not replace playback state or map focus.

### GPS, simulation, maps, and routes

- Keep GPS evidence distinct from manual simulation. Manual coordinates omit GPS accuracy and fix timestamps and must never become proof of physical presence or eligibility for automatic continuation.
- Preserve conservative evidence rules: fresh, accurate GPS, stop-distance plus accuracy threshold, and explicit GPS mode. Missing GPS must not silently fall back to a landmark; route-point fallback is for manual simulation only.
- Maps should initialize even when permission is denied. GPS updates move the visitor marker; following the visitor requires an explicit choice and stops after a map gesture.
- Use numeric `[longitude, latitude]` only at the Mapbox/GeoJSON boundary. API payloads remain `{ lat, lng }` strings. Never swap latitude and longitude while “simplifying” conversions.
- New tours use stored route geometry directly. Legacy tours retain their existing decoding/path behavior. Do not request a second route merely to render a route that the backend already stored.
- Route suggestions are revisioned. Preference edits invalidate prior suggestions and in-flight responses; a stale response must not overwrite a newer draft. Empty suggestions are legitimate infeasible/unverified outcomes and need the backend explanation.
- Do not claim step-free routing unless accessibility is verified for the whole path. Do not infer turns from named stops; display backend navigation status, instructions, and warnings.

### Text experience, interaction preferences, and guide behavior

- The text panel needs both frontend and backend feature flags. The frontend flag is not evidence that the backend endpoint or workers are enabled.
- Keep three concepts separate: guide-card default, visitor's stored selector (`guide`/`interactive`/`leading`), and backend effective response mode. Render the backend effective mode; do not infer it from the selector.
- A per-tour context change is not a future profile save. Preserve all other context fields, use the current revision and generation, and route it through the existing queue. Saving or clearing future preferences must remain an explicit profile action.
- `guide` can be ambiguous at creation when a tour context contains all legacy defaults and no explicit experience context exists: the backend may fall back to profile preferences. An active-tour `UPDATE_CONTEXT` persists explicit experience context and takes precedence. The frontend sends the selected value unchanged; do not hide the creation-time contract edge with a client-side special case.
- Guide personality improves the experience only when grounded in route evidence and the selected card. Do not invent human experiences, credentials, local facts, sources, or coordinates in the frontend. Visitor interests and exclusions must not be overwritten by guide specialties.
- Keep source links and evidence classification when available. A missing historical link should be labeled unavailable, not replaced with a fabricated or guessed URL.
- User-facing strings belong in English and Russian locale files. Use accessible native controls where possible and test loading, empty, error, disabled, and notification states—not only the happy path.

### Automatic continuation and media

- Story-buffer metadata/control transitions are frontend responsibilities; recording generation and media ownership remain backend responsibilities.
- Prepare at most once per newly started eligible story when the remaining-time and GPS rules are satisfied. Pause, movement, visitor actions, stale/uncertain GPS, settings changes, hidden pages, navigation, account changes, tour changes, and generation changes cancel or suspend continuation.
- Do not send speculative ordinary `/next` while an active segment is still playing. The legacy fallback requests only after completion acknowledgement and its delay; a silent `WAIT` ends the chain.
- Buffer preparation retains the current record. Adopt only the atomically activated response. Cancellation epochs must fence the asynchronous activation handoff.
- Story-buffer recovery stores operation/GPS metadata but no tokens, visitor text, audio, or media. Playback recovery also retains pending narration payloads, which can include visitor text and location. Preserve the original retry payload, avoid adding unrelated sensitive fields, and never copy recovery records into logs or diagnostics without redaction.
- **Current restriction: never generate, listen to, test, or benchmark audio without explicit human approval.** Use pure metadata/controller tests and the approved nonaudio checks. Do not run the audio-inclusive `test` suite or the default narration-contract `test:smoke` and `test:dev` commands under this restriction.

### Preparation progress and polling

- Preparation progress is an owner-scoped snapshot, not a percentage. Display observed phases, counts, sources, and byte totals without inventing completion math.
- List polling includes `PENDING`/`RUNNING` preparation, including tours that are already `STARTED`; it stops on terminal states or when the page leaves.
- Active-tour detail polling is independent from playback and must not replace the active tour record. Fence late results across account/tour changes, retry read failures on the existing schedule, and dispose timers.
- Backend workers matter. Running only the API can leave preparation apparently stuck; local verification needs the backend Compose stack and its workers when testing this flow.

## Product direction from past conversations

Past requests consistently favored tours that feel like real human guides: smooth, interesting, personal, attractive, and grounded. The safe implementation direction is not “add more frontend prompt text.” Instead:

- improve route quality and stop selection at the backend contract boundary;
- research and retrieve evidence before narration, with source/audit information;
- let guide cards steer voice and question style without becoming factual evidence;
- keep walking guidance short and useful while reserving longer stories for supported stop evidence;
- expose uncertainty, missing sources, unavailable providers, and infeasible routes instead of masking them;
- measure consumer-visible behavior with deterministic fixtures and explicit acceptance criteria before changing providers or pricing assumptions.

Provider, map, speech, and generation decisions belong in the backend architecture and operations documents. The frontend should integrate the contract, not choose credentials or silently compensate for an invalid backend response.

## Safe workflow for future work

1. Read `AGENTS.md`, the relevant frontend files, and the sibling backend contract/model/service.
2. Check the working tree. Treat existing modifications as user-owned; do not overwrite or “clean up” them.
3. Write down the state invariant and the stale/uncertain/error cases before editing. Identify every caller and response consumer.
4. Reuse the existing composable, queue, proxy helper, notification, locale, and test pattern. Avoid a parallel abstraction.
5. Make the smallest complete cutover: update all call sites, remove obsolete paths, and keep types, locales, docs, and tests aligned.
6. Run the narrowest meaningful nonaudio check first, then `pnpm test:text`, `pnpm typecheck`, `pnpm build`, and focused Prettier checks as applicable. Do not run concurrent commands that write `.nuxt`.
7. Exercise the changed nonaudio surface with a throwaway script or configured browser where possible. Treat live Firebase, Mapbox, GPS, backend-worker, provider, route-accessibility, and audio behavior as separate verification boundaries.
8. Update this document or `AGENTS.md` only when a durable contract, command, environment variable, or verification restriction changes. Do not edit generated `.nuxt/`, `.output/`, dependency files, or local secrets.

## Definition of done

Before calling a frontend change complete, confirm:

- every affected API caller, proxy handler, backend contract reference, type, locale, and test is aligned;
- stale responses, account changes, disposal, retries, uncertain outcomes, empty results, silent `WAIT`, and permission denial have defined behavior;
- GPS and manual simulation are not conflated;
- no secret, bearer token, media payload, or privileged provider call leaked into public configuration, bundles, or diagnostics; visitor text and recovery data remain within their documented authenticated API/local-storage boundaries;
- the approved nonaudio checks and relevant nonaudio browser scenario actually ran; the default smoke commands remain excluded until explicit human approval;
- documentation states what remains unverified rather than implying live provider or audio qualification.
