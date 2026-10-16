# Changelog

## 0.6.0 — 2026-10-04

- **Functional Countdown Bar & Explicit Infinite Idle Reset**: Synchronized the countdown bar with the combo idle timeout lifecycle so the progress bar genuinely drives combo expiration. When an idle timeout is active, the bar empties and resets the combo upon expiration; when idle reset is set to `0` (Infinite mode), the combo runs indefinitely without idle expiration. Added explicit `[ ∞ 无限 | 5秒 | 10秒 | 30秒 | 60秒 ]` quick preset selectors and localized value formatting (`无限 (永不清零)`) in both the Plugins configuration page and the HUD quick-tune popover. Fixed appearance schema persistence for `expireMs` and `pinPromptMs` in local quick tune.
- **Real-time Streaming Token Combos**: Listen directly to `assistant/live-chunk` deltas on the session event source to compute streaming token increments with smooth 40 ms pacing as the model generates text. Supports three combo modes: `hybrid` (streaming tokens + tool calls), `tokens` (streaming only), and `tools` (classic turn/round-based). Configurable `tokensPerCombo` ratio.
- **5 Distinct Visual Presets**: Enhanced visual themes with distinct physical mechanics: `particles` (crystalline particles), `fireworks` (spherical radial burst), `slash` (high-velocity laser blade incision & cross flash), `aura` (billowing plasma energy core), and `glitch` (cyberpunk chromatic scanline tear). Core keyframes built directly into local styles for zero-dependency rendering.
- **6 Synthesized Web Audio Sound Themes**: Added pure Web Audio sound designs with automatic node lifecycle cleanup: `blip` (soft chime), `keyboard` (mechanical switch click & chassis thock), `bubble` (satisfying liquid pop), `arcade` (8-bit chiptune arpeggio), `laser` (sci-fi plasma blaster), and `melodic` (crystal music box pentatonic chimes). Cooldown optimized to 35 ms for fluid rapid typing accompaniment.
- **5 Color Themes & Extended Count Tiers**: Added `classic`, `cyberpunk`, `sunset`, `matrix`, and `frost` palettes. Extended count tiers up to 500+ with cosmic violet (100+), cyber cyan (200+), inferno crimson (300+), and hyper prismatic rainbow (500+).
- **Embedded Live HUD Mini Simulator & Multi-tab Settings**: The configuration page under **Plugins → dsh-combo** features a real-time interactive mini HUD simulator, live stroke testing, and structured tabs (Basic, Effects, Appearance, Sound, Display, Advanced, and About).

## 0.5.0 — 2026-10-03

- Count each completed model round as one combo alongside tool calls; ignore stream chunks, failures, interrupted output, history replacements and repeated settlement. Rebuild projection checkpoints with state version 3.
- Drive number, bar, glow and particle colors from combo count across all presets. Explicit color overrides remain supported.
- Replace rising electronic beeps with quiet 75 ms percussive hits, bounded musical tier pitches, a downward envelope and a 60 ms overlap guard. Locked browsers drop automatic hits rather than queueing them.

## 0.4.0 — 2026-10-02

- Added a dedicated configuration page: the bundle now appears under **Plugins → dsh-combo → 配置** with every setting in one place, saved into the profile's row config instead of one browser's local storage.
- Added the sound controls the HUD panel was missing — switch, volume, starting combo and a 试听 audition — so the synthesized blip can be turned on without editing YAML.
- The Host half now declares a Schemastery `Config` with volatile fields, so a saved setting is committed into the running references and applies without restarting; the config route serves the live values, and the HUD repaints after a save.
- Saving a key from the configuration page clears that key's per-browser quick-tune override, so the profile value is what you see.
- Split the settings controls into one shared kit so the HUD panel and the configuration page cannot drift apart.

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
