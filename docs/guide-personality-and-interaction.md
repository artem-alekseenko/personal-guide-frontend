# Guide personality and interaction preference

Backend contract prepared on 30 September 2026. This is a frontend implementation handoff, not a completed UI feature or a deployment. Existing audio must remain in use. **Do not generate, listen to, test or benchmark audio; future audio verification MUST receive explicit human approval.**

## Visitor experience

Offer three choices in the personal-context form:

- **Guide's style / Стиль гида** (`guide`): follow the selected card's default.
- **Explore together / Исследовать вместе** (`interactive`): occasional optional observation questions, with space to reply.
- **Just guide me / Просто рассказывайте** (`leading`): connected stories and clear guidance without unsolicited questions or invitations to approach locals. Visitors can still ask their own questions and request a photo or rest pause.

Avoid labeling visitors as introverts or inferring a personality trait. “Introvert mode” is an accepted command alias. A quiet guide remains warm and detailed; this is not a mute switch or a change to walking speed. Explicit pause and safety/location constraints retain priority.

The opening introduces the selected AI guide by name and one distinctive approach, then connects to a supported local detail. Later replies retain the card's voice without repeating the introduction or claiming invented human experiences. The guide card also steers research questions and source selection. Visitor interests and exclusions override specialties.

## API and types

Backend source of truth: `../personal-guide.ai/app/models/guide.py`, `personal_context.py`, `tour_interaction.py`, and `services/guide_personality.py`.

| Field                                  | Values                            | Default                             |
| -------------------------------------- | --------------------------------- | ----------------------------------- |
| Guide card `interaction_mode`          | `interactive`, `leading`          | `interactive` for existing cards    |
| Personal context `interaction_mode`    | `guide`, `interactive`, `leading` | `guide`                             |
| Experience response `interaction_mode` | `interactive`, `leading`          | Effective mode, resolved by backend |

Update `app/types/index.ts` (`IGuide`), `app/types/personalContext.ts` and `emptyPersonalContext()`, and `app/types/tourExperience.ts`. Preserve missing-field defaults when reading older responses. A legacy card without the field defaults to interactive; explicitly mark a non-interactive card `leading`.

Add the choice to `app/components/tour/PersonalContextForm.vue`; use existing creation/profile settings flows. Saving a tour preference must not silently save a future profile preference. Keep the current personal context's other fields when changing this one.

For an active tour, use the existing authenticated interaction request:

```json
{
  "action": "UPDATE_CONTEXT",
  "expected_revision": 7,
  "generation_id": null,
  "context": {
    "enabled": true,
    "interests": ["engineering"],
    "interaction_mode": "leading"
  }
}
```

The example omits optional fields for brevity: the actual client must spread its full current context, then replace `interaction_mode`. Supply the actual revision and generation identity, and an idempotency key. Use the shared mutation queue and existing conflict reconciliation. A settings change supersedes earlier tour commands; choosing `guide` restores the card default. `FORGET_CONTEXT` clears personal memories but preserves the operational no-questions override; use the selector to explicitly change it.

`GET /tours/{id}/experience` returns the effective mode. Render available actions and cues from that response. Leading mode omits unsolicited QUESTION/LOCAL_TALK cues and removes LOCAL_TALK from suggested actions; an explicitly requested local-talk example can still be answered by the text interface. Regular questions, navigation, photo/rest controls and completion remain available.

## In-tour commands

The existing message field supports these exact phrases, case-insensitively, with optional leading “please” / «пожалуйста» and final punctuation:

| English                | Russian                    | Result      |
| ---------------------- | -------------------------- | ----------- |
| Don't ask me questions | Не задавай мне вопросы     | leading     |
| Use introvert mode     | Включи режим интроверта    | leading     |
| Just guide me          | Просто рассказывай         | leading     |
| Ask me questions again | Снова задавай мне вопросы  | interactive |
| Use interactive mode   | Включи интерактивный режим | interactive |

Send through the existing `/interactions` ASK/ANSWER or `/next` `user_text` path. The text endpoint acknowledges deterministically and saves the preference without invoking the writer. `/next` saves the control under the tour lease before narration, even if speech is currently blocked. It can increment the text experience revision; refresh/reconcile that state before the next text mutation. Neither path changes the global profile automatically.

Command recognition is intentionally bounded; quoted, reported, negated or compound instructions are not all parsed. The selector is authoritative for arbitrary phrasing. Do not optimistically claim that every natural-language request changed the mode; use the backend's effective mode.

The current-stop text panel still requires both frontend and backend feature flags. No new proxy endpoint is necessary. Do not use a direct browser-to-provider request.

## Example guide cards

Illustrative creation payloads; they are not seeded into a live database. Replace the illustrative avatar asset with an existing approved asset before publishing a card.

```json
{
  "name": "Mira",
  "avatar": "/images/guides/mira.png",
  "context": "Curious, warm and gently witty. Follows the people and decisions behind structures. Gives visitors time to answer without testing their knowledge.",
  "skills": "Explains engineering and craft through concrete details in everyday language. Uses occasional optional observation questions and thoughtful connections to visitor interests.",
  "tags": [{ "id": "engineering", "name": "engineering" }],
  "interaction_mode": "interactive"
}
```

```json
{
  "name": "Alex",
  "avatar": "/images/guides/alex.png",
  "context": "Calm, attentive and reflective. Leaves room to observe without demanding a response. Warm company for visitors who prefer to listen.",
  "skills": "Tells connected stories about architecture and daily life, explains precise sourced details, and gives clear verified guidance. Uses declarative observation suggestions instead of quizzes or prompts to approach strangers.",
  "tags": [
    { "id": "architecture", "name": "architecture" },
    { "id": "local_life", "name": "local_life" }
  ],
  "interaction_mode": "leading"
}
```

Both profiles are AI guide personas. Their cards are editorial direction, not evidence of historical facts, professional credentials or lived experience. No live guide records were created or altered for these examples.

## Frontend acceptance checks

1. Card default is reflected at creation; an explicit visitor selection takes precedence.
2. Selected mode survives reload and changing stop; a later explicit switch takes effect.
3. Updating the mode preserves interests, access needs and other context fields.
4. A quiet-mode switch clears an active QUESTION prompt and never undoes an explicit pause.
5. The visitor can still ask questions and use navigation, photo/rest and finish controls.
6. A command through the main tour controls refreshes/reconciles text experience revision.
7. EN/RU labels and acknowledgments are shown without treating the visitor as a personality category.
8. Ownership, generation conflicts, retries, account changes and pending mutations keep their existing behavior.

Use focused text tests and Prettier for this work. This document alone requires no application build. Backend source tests and provider text examples do not establish real GPS, browser or audio behavior.
