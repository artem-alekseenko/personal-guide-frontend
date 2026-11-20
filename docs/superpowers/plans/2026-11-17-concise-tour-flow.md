# Concise tour flow implementation plan

> Execute inline using superpowers:executing-plans.

Goal: make creation and research preparation concise and comfortable.
Architecture: preserve stores and API behavior; reorganize Vue views using native disclosures and existing status components.
Tech stack: Nuxt, Vue, TypeScript, i18n.
Spec: docs/superpowers/specs/2026-11-17-concise-tour-flow-design.md

## Constraints

No backend access, provider execution, sign-in or audio checks. Preserve unrelated work. English/Russian copy, keyboard access and narrow screens must work.

## Tasks

- [x] Add regressions for duration shortcuts, preference content within its disclosure, and collapsed technical preparation with visible status.
- [x] Add duration shortcuts; combine optional creation fields; simplify native planner primary actions and loading wording.
- [x] Reuse concise generation summary in native and legacy detail views; keep research controls in collapsed disclosures.
- [x] Shorten localized creation/research copy.
- [x] Run nonaudio tests, types, build, formatting, isolated browser fixtures, and final review.

## Verification

769 approved nonaudio tests in 82 files; type checking, production build and focused formatting passed. Offline Chromium checked the legacy and native creation flows, duration presets and keyboard slider, preferences, running/failed/ready preparation, and research disclosure at mobile/desktop widths in English/Russian and light/dark. All API responses were local fixtures; no backend/provider/audio access.

The accompanying Back fix uses router.currentRoute to avoid Nuxt deferred-route timing, keeps its controller mounted on My Tours, preserves full settings return URLs, reconciles native Back, and retains history after cancelled navigation. Real Vue Router browser checks cover repeated UI Back, native browser Back, queries, anchors and settings return. Review found and resolved the deferred-route issue; no unresolved findings remain.
