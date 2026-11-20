# Route-native client integration

New guide planning uses `/create-walk`. Historical tours retain `LegacyTourWalk`
and the existing `/create-route` view remains readable for compatibility.
Native tours are detected by `tour.route.walking_plan` and mount only
`NativeTourWalk`; the legacy playback, story buffering and text schedulers are
never initialized beside the native controller.

After creation, `/tours/:tourId` shows the cover, description, route estimates,
available highlights, and preparation progress. When the playable session is
available, **Tour ready** opens `/tours/:tourId/walk` without changing the
session. The visitor chooses GPS or simulation and starts from that page.
Opening an already started tour also opens the walking view. The URL change
keeps the same native controller mounted. Progress polling
uses the owner-bound generation API, and terminal status refreshes tour
metadata. The cover and description may arrive after publication.

Quiet-stretch deliveries use `kind: transition`, a null subject, no claim IDs
and `evidence_status: not_applicable`. They use the same controller and delivery
acknowledgements as stories. Their wording does not establish historical facts
or visibility, and they do not replace the current discussion subject.

The authenticated Nitro proxy uses `X-Tour-Contract-Version: 3`. Walking plans
are server-owned snapshots selected by ID during contract v3 creation. No stops,
synthetic subjects or client geometry are used as proof of a validated path.
Native session GET never starts the walking clock or speech. GPS sends
LOCATION_UPDATE only after Start; automatic activation submits the supplied
eligibility operation key and action ID. Each other operation gets a UUID and
retains the exact body/key while its result is uncertain.

One Pinia controller owns mutations within a view; the browser Web Locks API
excludes another tab or window from controlling the same account/tour. Without
Web Locks the view is read-only. Reload recovers active text and delivery
identity without autoplay. Explicit Resume or Play is needed to hear restored
content. Tour pause is sent separately from audio interruption. Actual `playing`
and final `ended` events acknowledge started/completed respectively. If audio is
unavailable, the full passage stays visible for a reading interval (180 words per
minute, at least eight seconds); hidden-page time does not complete that interval.
Next step explicitly completes the displayed passage and requests another.
If the position is missing, stale or rejected, it requests a fresh GPS fix first
and explains location problems beside the controls. Backend silence gets its own
message instead of leaving an apparently inactive Next step button.
Automatic completion uses only the backend's next eligible action, and stops
when none is offered. A fresh GPS observation can resume automatic guidance;
location changes received during another request are coalesced to the latest fix.
Scheduling-only checkbox changes preserve current audio playback. Finish cancels
local playback and reading timers before finishing the backend session.
The walking page shows the map, GPS/Simulation selector, and tour name. Before
start, it shows **Start tour** and a disabled question form. After start, it
shows **Next step**, **Finish tour**, and the question form. An acknowledged
finish returns to the tour list. Questions use the current context.

POST `/walk/audio` is separate from activation and returns the existing
AudioManifest contract or null. Chunks must be complete, ordered, same-language
and bound to the SHA-256 of the exact active text. Bytes are fetched through the
existing authenticated artifact proxy. Changed owner, generation, pause/control
revision, active delivery or disposed controller fences late media responses.
There is no browser speech synthesis or claim of provider success when audio is
unavailable.

The patch is applied. Controlled nonaudio client tests, the existing text suite,
type checking, production build and focused formatting passed. The backend also
passed a disposable-Mongo journey with controlled map/research providers.
The approved nonaudio `test:text` command includes native-walk regressions.
Browser/Firebase/Mapbox behavior, physical GPS and heard audio remain unverified.
Existing audio restrictions remain in force; no frontend media was generated,
played or tested. No deployment was performed.

The native walking screen includes the existing Real GPS / Simulation selector.
Simulation uses a separate position source, seeded from the route origin (or the
saved simulated position when reopening). Clicking the map or dragging the purple
walker updates the same controller used by Start, Next step and automatic guidance.
It sends explicit `position_mode: "simulation"`; the real GPS store is untouched.
Map jumps select geographic context without proving traversal or finishing the walk.
Switching to Real GPS restores device observations. Reading/Next renew the explicit
simulated placement timestamp so a long passage does not require device GPS.

Finished native walks show Continue walk. It sends `REOPEN` through the same
serialized, idempotent controller, refreshes the selected position and requests
the next available passage. The server retains completed-story memory and position;
it does not create a new tour. Reopened walks stay open until Finish, including
beyond planned duration (shown as Extra time). Next step/Finish return after the
confirmed reopen; unavailable location or exhausted knowledge still has normal
visible feedback. Uncertain mutations retain the original operation for retry.

Background reads, location observations and automatic passage completion do not
fade/disable walking controls. Foreground actions still block duplicate clicks;
all mutations use the same serialized queue, and uncertain requests still block
new mutations. Moving to another reliable position clears the previous location's
silence message. Missing saved local research has distinct feedback from exhausted
passages; the client does not promise that new research is running.
