# Route-native client integration

New guide planning uses `/create-walk`. Historical tours retain `LegacyTourWalk`
and the existing `/create-route` view remains readable for compatibility.
Native tours are detected by `tour.route.walking_plan` and mount only
`NativeTourWalk`; the legacy playback, story buffering and text schedulers are
never initialized beside the native controller.

After creation, the client opens the new tour's preparation screen. Native list
cards and detail views share `NativeWalkPreparation`, which mounts the existing
research progress meter, source/spend information and research controls. Factual
progress is polled through the owner-bound generation API; terminal status
refreshes the tour metadata without requiring a browser reload. The list link
says “View research progress” while generating and “Open walk” once prepared.
The requested duration in the title and provider walking-time estimate are
separate values.

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
and final `ended` events acknowledge started/completed respectively; interruptions
never declare factual completion. Text can be explicitly acknowledged as read.

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
