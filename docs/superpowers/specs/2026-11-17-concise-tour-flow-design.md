# Concise tour creation and preparation

The user chose a concise flow with optional preferences tucked away and a calm progress screen.

Keep location, duration and route preview prominent. Offer quick duration choices alongside the existing slider. Keep personalization and topics in one collapsed section. Use one primary action for each stage, with honest loading and uncertainty states. Shorten English and Russian helper text.

Show existing generation status, percent and one brief activity at the top of tour details. Put research information and controls in a closed disclosure. Preserve cancellation, retry, regeneration, publication, preview warnings and incomplete results. Do not alter providers, backend contracts, audio, or playback behavior.

Approaches considered: restyle all existing fields in place (still crowded); hide all research functionality (loses recovery); progressive disclosure (selected by user, preserves access while simplifying the main flow).

Reuse Vue, existing stores, TourGenerationStatus and native details. No new dependencies. Verify both creation paths, running/failed/ready preparation, keyboard use, mobile/desktop and English/Russian.
