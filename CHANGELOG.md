# Changelog

## 0.3.0 — 2026-10-02

- Added a remaining-time countdown bar that refills on tool calls and keeps its deadline across cosmetic changes.
- Added a live appearance panel with 22 controls, including effect threshold/frequency, shake, colors, meter size, particles, offsets and visibility; settings persist locally and can be reset.
- Use the original call timestamp when adopting a conversation; countdown stays functional with reduced motion or feedback disabled.

- Replaced the glass card with a PowerMode-style white multiplier, bright top bar and colored glow.
- Added particles, flames, fireworks and rift presets, with an inline selector and locally saved preference.
- Added the default `preset` configuration and respected theme colors and reduced motion across presets.
- Clear transient effects when switching conversations.

## 0.2.2 — 2026-10-02

- Reworked the combo HUD into a glassy meter with a compact vector pin control.
- Added a radial flash and tier-scaled spark burst on every tool call while particles are enabled.
- Strengthened the number pop and floating gain feedback.

## 0.2.1 — 2026-10-02

- Fixed the root overlay to read the active Session from `uiSession.adapter.current` and subscribe through `sessions.binding(id).session.projections`.
- Updated the Client fixture to model the current public DSH Session Controller contract.
- Exported `./package.json` for Client package discovery and removed the unnecessary `dsh.client.immediately` flag.
- Restored an empty render when the HUD is disabled, expired, or has no combo; removed the temporary mount diagnostic.
- Made `animation: strong` visibly stronger and documented the package, install, configuration, and troubleshooting paths in English and Chinese.
