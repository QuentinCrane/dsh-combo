# dsh-combo

English | [简体中文](README.zh-CN.md)

A lightweight DeepSeek Harness (DSH) plugin that displays per-turn thinking and tool-call combos in DSH Web and DSH Desktop. Each completed model round (`assistant/message`) and committed `tool/call` adds one; the counter resets at a turn boundary.

![Countdown demo](docs/combo-countdown.gif)

## Features

- Listens to real-time streaming chunks (`assistant/live-chunk`) to compute token-level combos as the model types, delivering immediate visual and audio hits! Also respects Host's `dshCombo` projection and committed tool calls.
- Keeps the counter turn-based by default. Set `expireMs` to opt into an idle timeout; adjust `tokensPerCombo` to tune tokens needed per combo hit.
- Shows the latest thinking/tool/output activity, tiered visual feedback, optional sound, and a per-session pin that can carry a streak across turns.
- Carries its own configuration page on the **Plugins** page, where every setting — sound included — is saved into the profile and applied live.
- Runs in the DSH Web Client, including the Web UI embedded in DSH Desktop. It does not add content to model requests or contact a third-party service. Pin state is stored in the client page's `localStorage`.

## Install with the official CLI

This is an independent community plugin installed through the official `dsh plugin` CLI. It is not produced by DeepSeek. It ships runnable JavaScript with no install-time build scripts.

Install into the profile you use. Web and Desktop have separate profiles:

```sh
# DSH Web UI
dsh plugin --profile web add github:QuentinCrane/dsh-combo

# DSH Desktop
dsh plugin --profile desktop add github:QuentinCrane/dsh-combo
```

For DSH Desktop, launch the app once to initialize its profile, fully quit it, and run Desktop's bundled `dsh` command. If that command is not on your PATH, enable it through **Manage dsh Command** in the app first. Reopen Desktop after installation. See the [official Desktop guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.md#bundled-command-runtime).

To install a local checkout instead, use the path to the directory containing `package.json`:

```sh
dsh plugin --profile <profile> add link:/absolute/path/to/dsh-combo
```

Check that the bundle layer appears in the profile before launching:

```sh
dsh --profile web --dump-config
dsh --profile web
```

The plugin contributes a Host projection and a DSH Client module. DSH Desktop embeds the same Web application, so the module also runs there when installed into the `desktop` profile. DSH requires Client modules to declare `platform: web`; this describes the Client runtime contract and does not mean the plugin is limited to the standalone Web profile. After installing or changing package files, restart the profile unless its HMR setup has applied the change.

## Configure

### In the app

Open **Plugins** in the sidebar, select the `dsh-combo` bundle, and use the configuration section on its page. Every setting lives there — including the sound switch, volume and starting combo — and a save is written into the profile's row config and applied immediately, with no restart and no page reload.

The HUD's own gear panel stays a per-browser quick tune on top of that: it previews changes for this browser only and keeps them in local storage. Saving the same key from the Plugins page clears that local override, so the profile value is what you see. The panel's **恢复默认设置** drops every local override and goes back to the configured values.

### In the profile patch

The bundle provides working defaults in `cordis.patch.yml`. To override them by hand, add a later row for `dsh-combo` in the profile's `cordis.patch.yml`:

```yaml
- id: dsh-combo
  config:
    enabled: true
    showToolName: true
    animation: normal
    particles: true
    preset: particles
    timerMs: 10000
    powerThreshold: 0
    effectFrequency: 1
    shake: true
    shakeIntensity: 3
    scale: 1
    offsetX: 18
    offsetY: 10
    barHeight: 7
    particleCount: 0
    particleSize: 4
    particleSpread: 1
    effectDurationMs: 820
    glow: 1
    accentColor: ''
    numberColor: ''
    showGain: true
    showTimer: true
    position: top-right
    excludeTools: []
    expireMs: 0
    sound: false
    soundTheme: blip
    soundVolume: 0.35
    soundFrom: 10
    pinPromptMs: 5000
```

DSH patch layers replace a row's complete `config` object. Include every setting you want to keep when overriding the row.

| Setting | Default | Meaning |
|---|---:|---|
| `enabled` | `true` | Show the HUD. |
| `comboMode` | `hybrid` | Combo calculation mode: `hybrid` (stream tokens + tool calls), `tokens` (streaming tokens only), or `tools` (classic: tool calls and settled rounds only). |
| `showToolName` | `true` | Show the most recent tool below the counter. |
| `animation` | `normal` | `off`, `normal`, or `strong`; `strong` uses a larger pop. Reduced-motion preferences disable CSS animation. |
| `particles` | `true` | Emit the selected effect on each combo gain while animation is enabled; particle density grows with the combo tier. |
| `preset` | `particles` | Default effect: `particles` (particles), `fireworks` (fireworks), `slash` (blade slash), `aura` (energy aura), or `glitch` (cyber glitch). |
| `position` | `top-right` | `top-right`, `top-left`, `bottom-right`, or `bottom-left`. |
| `excludeTools` | `[]` | Tool names to ignore, matched without case sensitivity. |
| `expireMs` | `0` | Optional idle reset in milliseconds; `0` enables infinite mode (never reset on idle). Includes quick presets `[ ∞ Infinite | 5s | 10s | 30s | 60s ]`. Maximum: `600000`. |
| `sound` | `false` | Play synthesized audio hits; rapid calls within 60 ms coalesce. |
| `soundTheme` | `blip` | Audio theme: `blip` (soft chime), `keyboard` (mechanical switch thock), `bubble` (satisfying pop), `arcade` (8-bit chiptune), `laser` (sci-fi beam), `melodic` (rising pentatonic scale). |
| `soundVolume` | `0.35` | Hit volume from `0` to `1`. |
| `soundFrom` | `10` | First count that plays a hit. Range: `0` to `1000`. |
| `pinPromptMs` | `5000` | How long a finished run of at least two calls remains available to pin. Maximum: `60000`; `0` disables the prompt. |

Invalid enum values use their defaults; numeric settings are clamped to their documented ranges. The Host half declares every setting as a volatile field of its Schemastery `Config`, which is what puts them on the Plugins page and lets a write apply without restarting the row.

## Display behavior

A completed model round counts once even when the provider does not expose reasoning text; its label is 思考. Streaming chunks, failed attempts, interrupted prefixes, history replacements and repeated settlement of the same turn/step do not add combos. Thinking and tools both refill the countdown.

| Count | Display |
|---|---|
| 1–9 | Green multiplier, bar and glow and square particles |
| 10–19 | Larger multiplier, yellow-green glow and more particles |
| 20–49 | Yellow glow, slight shake and denser particles |
| 50+ | Orange glow, largest multiplier and densest particles |

The unboxed PowerMode-style meter displays a bold multiplier beneath a bright bar. Use the selector below it to switch between 5 distinct visual presets (particles, fireworks, slash, aura, and glitch); switching previews the effect without changing the count. Your choice is saved locally and overrides the configured default `preset`. All presets share count-driven colors: green at 1–9, yellow-green at 10–19, yellow at 20–49, orange at 50–99, cosmic violet at 100+, cyber cyan at 200+, inferno crimson at 300+, and hyper prismatic rainbow at 500+. Presets change the motion, while explicit custom colors and color themes override this palette.

The 📌 button keeps the current run as a streak for that Session. When an unpinned turn ends, a run of at least two calls stays dimmed for `pinPromptMs`; pin it during that window to continue counting across turns. Pin state survives a page reload in local storage.

## Appearance and rhythm

Use the gear beside the meter to edit appearance, timing and effects immediately. Preferences are saved locally; Reset clears local overrides and restores the configured defaults.

The countdown bar visually shows the remaining active combo window. When `expireMs` is configured, the countdown bar drains over that window and resets the combo upon expiry; when set to `0` (or the ∞ Infinite preset), it runs in infinite mode without idle timeout. Pinned streaks remain preserved across turns.

| Option | Default | Range | Description |
|---|---|---|---|
| `expireMs` | `0` | 0–600000 ms | Idle reset time; `0` indicates infinite mode (never expires on idle). Quick preset buttons available. |
| `timerMs` | `10000` | 1000–60000 ms | Base countdown bar duration; overridden by `expireMs` when idle reset is active. |
| `powerThreshold` | `0` | 0–1000 | Combo needed to activate feedback and effects. |
| `effectFrequency` | `1` | 1–20 | Combo gains per burst; batches crossing a trigger boundary also emit. |
| `shake` | `true` | boolean | Independent combo-shake switch. |
| `shakeIntensity` | `3` | 0–12 px | Shake amplitude. |
| `scale` | `1` | 0.5–2 | Scale the meter and its particles. |
| `offsetX` | `18` | 0–240 px | Horizontal edge offset. |
| `offsetY` | `10` | 0–240 px | Vertical edge offset, clearing window chrome at the top. |
| `barHeight` | `7` | 2–16 px | Countdown bar height. |
| `particleCount` | `0` | 0–80 | Particles per burst; `0` automatically scales with combo tiers. |
| `particleSize` | `4` | 1–12 px | Particle size. |
| `particleSpread` | `1` | 0.25–2 | Spread multiplier. |
| `effectDurationMs` | `820` | 200–2500 ms | Burst animation duration. |
| `glow` | `1` | 0–2 | Glow strength; `0` turns it off. |
| `accentColor` | `''` | #RRGGBB or empty | Override glow and particle color; empty uses combo tier colors. |
| `numberColor` | `''` | #RRGGBB or empty | Override the number and bar color; empty follows combo tier colors. |
| `showGain` | `true` | boolean | Display the floating `+N` gain. |
| `showTimer` | `true` | boolean | Display the countdown bar. |

Inspired by [VS Code PowerMode](https://github.com/hoovercj/vscode-power-mode): remaining time expresses rhythm, threshold and frequency control feedback, and presets combine with independent customization. This implementation uses CSS animations and DSH session projections, with completed model rounds and tool calls driving feedback.

## Repository layout

```text
dsh-combo/
├── index.js              # Host Session Projection and config route
├── client.js             # DSH Client module and overlay HUD
├── cordis.patch.yml      # Installable DSH bundle layer
├── package.json          # Bundle and Client module manifests
├── test/                 # Host and Client unit tests with local runtime shims
├── docs/                 # Development, publishing, and troubleshooting notes
├── README.md
├── README.zh-CN.md
├── CONTRIBUTING.md
├── CHANGELOG.md
└── LICENSE
```

## Development

Run the local unit suite with:

```sh
npm test
```

The Client reads the active binding from `uiSession.adapter.current` and subscribes to `sessions.binding(id).session.projections.faceOf('dshCombo')`. The Host owns the fold over committed Session events. `dsh.client.inject` lists package relationships; the Client plugin's exported Cordis `inject` list declares the runtime services it waits for.

Release and npm distribution notes live in [docs/publishing.md](docs/publishing.md): the release workflow tests, publishes the version to npm once `NPM_TOKEN` is configured, and always creates the GitHub release with the packed tarball.

For the public bundle and Client contracts, see the [DSH plugin publishing guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md), [Client Modules reference](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/client-modules), [Session Projections reference](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/session-projection), [official Client package rules](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/AGENTS.md), and [Desktop guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.md). DSH is in developer preview and may introduce breaking API changes.

For GitHub discoverability, add the `dsh-plugin` topic to the repository.
